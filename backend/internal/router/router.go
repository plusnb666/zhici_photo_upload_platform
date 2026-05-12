// 路由注册：组装 service → handler → middleware 的依赖链，注册所有 API 端点
// 路由分组：
//   - /api/health         公开健康检查
//   - /api/v1/auth/*      认证相关（注册、登录、刷新令牌）
//   - /api/v1/public/*    公开接口（无需登录的公开图库）
//   - /api/v1/images/*    图片 CRUD（需登录）
//   - /api/v1/tags/*      标签管理（需登录）
//   - /api/v1/admin/*     管理后台（需管理员角色）
package router

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/nbplus/image_upload_platform/internal/config"
	"github.com/nbplus/image_upload_platform/internal/handler"
	"github.com/nbplus/image_upload_platform/internal/middleware"
	"github.com/nbplus/image_upload_platform/internal/service"
	"github.com/nbplus/image_upload_platform/internal/storage"
)

// Setup 构建 Gin 引擎，返回路由和 adminService（用于后台定时任务）
// 依赖注入链：DB + Redis + Storage → Service → Handler → Middleware → Route
func Setup(cfg *config.Config, db *pgxpool.Pool, rdb *redis.Client, fileStorage storage.FileStorage) (*gin.Engine, *service.AdminService) {
	if cfg.AppEnv == "development" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// ── 全局中间件 ──
	r.Use(middleware.Recovery())       // panic 恢复，返回 500 而非崩溃
	r.Use(middleware.Logger())         // 结构化请求日志
	r.Use(middleware.CORS())           // 跨域配置
	r.Use(middleware.SecurityHeaders()) // X-Content-Type-Options 等安全头

	// ── 服务层初始化 ──
	authSvc := service.NewAuthService(db, cfg.JWTSecret)                      // 认证逻辑
	imageSvc := service.NewImageService(db, fileStorage, cfg.CDNBaseURL,      // 图片核心逻辑
		cfg.UploadMaxSizeMB, cfg.StorageQuotaGB)
	tagSvc := service.NewTagService(db)                                       // 标签管理
	adminSvc := service.NewAdminService(db, fileStorage)                      // 管理后台

	// ── 处理器层初始化 ──
	healthH := handler.NewHealthHandler()
	authH := handler.NewAuthHandler(authSvc)
	imageH := handler.NewImageHandler(imageSvc)
	tagH := handler.NewTagHandler(tagSvc)
	adminH := handler.NewAdminHandler(adminSvc)

	// ── 路由注册 ──

	// 健康检查（K8s / Docker 探针）
	r.GET("/api/health", healthH.Liveness)        // 进程存活
	r.GET("/api/health/ready", healthH.Readiness)  // DB + Redis + S3 就绪

	// 认证（公开，无需 Token）
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/register", middleware.RateLimit(rdb, 3, time.Minute), authH.Register)  // 注册限流：3次/分钟
		auth.POST("/login", middleware.RateLimit(rdb, 10, time.Minute), authH.Login)       // 登录限流：10次/分钟
		auth.POST("/refresh", authH.Refresh)    // 刷新 access token
		auth.POST("/logout", authH.Logout)      // 吊销 refresh token
	}

	// 公开接口（无需认证）
	public := r.Group("/api/v1/public")
	{
		public.GET("/images", imageH.ListPublic)      // 公开图库列表
		public.GET("/images/:id", imageH.GetPublic)   // 公开图片详情
	}

	// 需要认证的路由
	api := r.Group("/api/v1")
	api.Use(middleware.Auth(cfg.JWTSecret))  // JWT 中间件：提取 user_id + role 到 context
	{
		api.GET("/auth/me", authH.Me)  // 当前用户信息

		// 图片相关
		images := api.Group("/images")
		{
			images.POST("/upload", middleware.RateLimit(rdb, 30, time.Minute), imageH.Upload) // 上传限流：30次/分钟
			images.GET("", imageH.List)                    // 我的图片列表
			images.GET("/:id", imageH.Get)                 // 图片详情
			images.GET("/:id/download", imageH.Download)   // 下载（Content-Disposition: attachment）
			images.DELETE("/:id", imageH.Delete)           // 删除（硬删除，同步删文件）
			images.PATCH("/:id", imageH.Update)            // 更新元数据
			images.POST("/:id/tags", imageH.AddTags)       // 添加标签
			images.DELETE("/:id/tags/:tagId", imageH.RemoveTag)  // 移除标签
			images.POST("/:id/toggle-tag", imageH.ToggleTag)     // 切换标签（点赞模式）
			images.POST("/batch-delete", imageH.BatchDelete)     // 批量删除
		}

		// 标签
		tags := api.Group("/tags")
		{
			tags.GET("", tagH.List)                           // 标签列表（含使用计数）
			tags.POST("", tagH.Create)                        // 创建标签
			tags.DELETE("/:id", middleware.Admin(), tagH.Delete) // 删除标签（仅管理员）
		}

		// 管理后台（需 admin 角色）
		admin := api.Group("/admin")
		admin.Use(middleware.Admin())
		{
			admin.GET("/stats", adminH.Stats)                 // 总览统计
			admin.GET("/stats/tags", adminH.TagStats)         // 标签统计
			admin.GET("/stats/upload-trend", adminH.UploadTrend) // 30天上传统计
			admin.POST("/sync", adminH.SyncTag)               // 手动同步打印图片
			admin.GET("/sync/status", adminH.SyncStatus)      // 同步状态
			admin.GET("/users", adminH.ListUsers)             // 用户列表
			admin.PATCH("/users/:id", adminH.UpdateUser)      // 修改用户（角色等）
			admin.GET("/images", adminH.ListImages)           // 全局图片管理
			admin.DELETE("/images/:id", adminH.DeleteImage)   // 强制删除图片
		}
	}

	return r, adminSvc
}
