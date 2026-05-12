package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"
	"github.com/nbplus/image_upload_platform/pkg/response"
)

func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				slog.Error("panic recovered",
					"error", err,
					"stack", string(debug.Stack()),
				)
				response.Error(c, http.StatusInternalServerError, 50000, "Internal server error")
				c.Abort()
			}
		}()
		c.Next()
	}
}
