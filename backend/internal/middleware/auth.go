// 认证与授权中间件
// Auth: 从 Authorization 头提取并验证 JWT，将 user_id 和 role 注入 Gin context
// Admin: 检查 role == "admin"，拒绝非管理员访问
package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	jwtpkg "github.com/nbplus/image_upload_platform/pkg/jwt"
	"github.com/nbplus/image_upload_platform/pkg/response"
)

// Auth JWT 认证中间件
// 从 Authorization: Bearer <token> 提取 access token
// 验证通过后设置：c.Set("user_id", xxx) 和 c.Set("role", "user"|"admin")
// 验证失败返回 401
func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			response.Unauthorized(c, "Missing authorization token")
			c.Abort()
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := jwtpkg.ValidateAccessToken(jwtSecret, tokenStr)
		if err != nil {
			response.Unauthorized(c, "Invalid or expired token")
			c.Abort()
			return
		}
		// 注入到 Gin context，后续 handler 通过 c.GetInt64("user_id") / c.GetString("role") 获取
		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// Admin 角色检查中间件
// 必须在 Auth 中间件之后使用（依赖 Auth 注入的 "role" context 值）
// 非 admin 用户返回 403
func Admin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != "admin" {
			response.Forbidden(c, "Admin access required")
			c.Abort()
			return
		}
		c.Next()
	}
}
