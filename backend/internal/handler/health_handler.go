package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/nbplus/image_upload_platform/pkg/response"
)

type HealthHandler struct{}

func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

func (h *HealthHandler) Liveness(c *gin.Context) {
	response.OK(c, gin.H{"status": "alive"})
}

func (h *HealthHandler) Readiness(c *gin.Context) {
	response.OK(c, gin.H{"status": "ready"})
}
