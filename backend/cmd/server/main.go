// 赤子の相册 - 图床服务入口
// 负责初始化所有基础设施（数据库、缓存、存储）并启动 HTTP 服务
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/nbplus/image_upload_platform/internal/config"
	"github.com/nbplus/image_upload_platform/internal/router"
	"github.com/nbplus/image_upload_platform/internal/storage"
)

func main() {
	// 加载配置：从环境变量读取数据库、Redis、S3、JWT 等参数
	cfg := config.Load()

	// 开发环境用可读文本日志，生产环境用结构化的 JSON 日志
	if cfg.AppEnv == "development" {
		slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})))
	} else {
		slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))
	}

	// ─── PostgreSQL 连接 ───
	// 使用 pgxpool 连接池，最小 2 个连接，最大 20 个
	slog.Info("connecting to database", "host", cfg.DBHost)
	dbCtx, dbCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer dbCancel()

	dbCfg, err := pgxpool.ParseConfig(cfg.DSN())
	if err != nil {
		slog.Error("failed to parse db config", "error", err)
		os.Exit(1)
	}
	dbCfg.MaxConns = 20
	dbCfg.MinConns = 2

	db, err := pgxpool.NewWithConfig(dbCtx, dbCfg)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := db.Ping(dbCtx); err != nil {
		slog.Error("database ping failed", "error", err)
		os.Exit(1)
	}
	slog.Info("database connected")

	// 自动建表（幂等，已存在的表不会重复创建）
	runMigrations(db)

	// ─── Redis 连接 ───
	// Redis 不可用时仅告警不退出，限流功能降级但服务继续
	rdb := redis.NewClient(&redis.Options{
		Addr: cfg.RedisAddr(),
	})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		slog.Warn("redis connection failed, continuing without redis", "error", err)
	} else {
		slog.Info("redis connected")
		defer rdb.Close()
	}

	// ─── 对象存储初始化 ───
	// 优先连接 MinIO/S3，连接失败则回退到本地文件系统
	var fileStorage storage.FileStorage
	storageCtx, storageCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer storageCancel()

	s3Storage, err := storage.NewS3Storage(cfg.S3Endpoint, cfg.S3AccessKey, cfg.S3SecretKey, cfg.S3Bucket, cfg.S3UseSSL)
	if err != nil {
		slog.Warn("s3/minio storage unavailable, using local storage", "error", err)
		fileStorage = storage.NewLocalStorage("./uploads")
	} else {
		_, err := s3Storage.GetPresignedURL(storageCtx, "test", 1)
		if err != nil {
			slog.Warn("s3/minio not reachable, using local storage", "error", err)
			fileStorage = storage.NewLocalStorage("./uploads")
		} else {
			fileStorage = s3Storage
			slog.Info("s3/minio storage connected")
		}
	}

	// ─── 路由注册 ───
	// 组装所有 service → handler → middleware → route
	r, adminSvc := router.Setup(cfg, db, rdb, fileStorage)

	// ─── 后台任务：每 5 分钟把「打印」标签的图片同步到 /exports ───
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			added, removed, err := adminSvc.SyncTaggedImages(context.Background(), "打印", "/exports")
			if err != nil {
				slog.Error("sync failed", "error", err)
			} else {
				slog.Info("sync complete", "added", added, "removed", removed)
			}
		}
	}()

	// ─── HTTP 服务器 ───
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.AppPort),
		Handler:      r,
		ReadTimeout:  30 * time.Second,  // 防止慢客户端占用连接
		WriteTimeout: 60 * time.Second,  // 上传大文件需要较长写超时
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		slog.Info("server starting", "port", cfg.AppPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	// ─── 优雅关闭 ───
	// 捕获 SIGINT/SIGTERM，停止接收新请求，等待进行中的请求完成（最多 30 秒）
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("forced shutdown", "error", err)
	}

	slog.Info("server stopped")
}

// runMigrations 在启动时自动建表，使用 IF NOT EXISTS 保证幂等
// 生产环境建议使用 golang-migrate 管理版本化迁移，此处为简化部署采用内联 SQL
func runMigrations(db *pgxpool.Pool) {
	ctx := context.Background()
	migrations := []string{
		// 用户表：支持普通用户和管理员两种角色
		`CREATE TABLE IF NOT EXISTS users (
			id              BIGSERIAL PRIMARY KEY,
			username        VARCHAR(64)  NOT NULL UNIQUE,
			email           VARCHAR(255) NOT NULL UNIQUE,
			password_hash   VARCHAR(255) NOT NULL,       -- bcrypt 哈希
			role            VARCHAR(16)  NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
			avatar_url      VARCHAR(512),
			storage_used    BIGINT       NOT NULL DEFAULT 0,       -- 已用存储（字节）
			created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
		`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,

		// 图片表：核心实体，支持软删除（通过 deleted_at）
		`CREATE TABLE IF NOT EXISTS images (
			id              BIGSERIAL PRIMARY KEY,
			user_id         BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			filename        VARCHAR(255) NOT NULL,    -- 用户上传时的原始文件名
			storage_key     VARCHAR(512) NOT NULL,    -- MinIO/S3 中的对象 key
			mime_type       VARCHAR(64)  NOT NULL,
			file_size       BIGINT       NOT NULL,    -- 字节
			width           INT,                      -- 图片宽度（可选）
			height          INT,                      -- 图片高度（可选）
			thumbnail_key   VARCHAR(512),             -- 缩略图在 MinIO 中的 key
			alt_text        VARCHAR(512),
			view_count      BIGINT       NOT NULL DEFAULT 0,
			is_public       BOOLEAN      NOT NULL DEFAULT TRUE,  -- 是否公开可见
			deleted_at      TIMESTAMPTZ,              -- 软删除时间戳
			created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_images_deleted_at ON images(deleted_at) WHERE deleted_at IS NULL`,

		// 标签表：预定义标签（点赞、收藏、好看、有趣、优秀、打印 等）
		`CREATE TABLE IF NOT EXISTS tags (
			id              BIGSERIAL PRIMARY KEY,
			name            VARCHAR(64)  NOT NULL UNIQUE,
			color           VARCHAR(7)   DEFAULT '#1890ff',  -- 前端显示用的色值
			created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,

		// 图片-标签关联表：多对多，主键为 (image_id, tag_id, user_id)
		// 同一用户对同一图片的同一标签只能标记一次
		`CREATE TABLE IF NOT EXISTS image_tags (
			image_id        BIGINT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
			tag_id          BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
			user_id         BIGINT REFERENCES users(id),
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (image_id, tag_id, user_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_image_tags_tag_id ON image_tags(tag_id)`,

		// 刷新令牌表：支持服务端吊销
		`CREATE TABLE IF NOT EXISTS refresh_tokens (
			id              BIGSERIAL PRIMARY KEY,
			user_id         BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash      VARCHAR(255) NOT NULL UNIQUE,   -- SHA-256 哈希
			expires_at      TIMESTAMPTZ  NOT NULL,
			revoked         BOOLEAN      NOT NULL DEFAULT FALSE,
			created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked = FALSE`,

			// 评论表
			`CREATE TABLE IF NOT EXISTS comments (
				id         BIGSERIAL PRIMARY KEY,
				image_id   BIGINT      NOT NULL REFERENCES images(id) ON DELETE CASCADE,
				user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				content    TEXT        NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`,
			`CREATE INDEX IF NOT EXISTS idx_comments_image ON comments(image_id, created_at)`,
		}

	for i, m := range migrations {
		if _, err := db.Exec(ctx, m); err != nil {
			slog.Error("migration failed", "index", i, "error", err)
		}
	}
	slog.Info("migrations complete")
}
