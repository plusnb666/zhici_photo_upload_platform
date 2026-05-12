package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/nbplus/image_upload_platform/internal/service"
	"github.com/nbplus/image_upload_platform/pkg/response"
)

type AdminHandler struct {
	svc *service.AdminService
}

func NewAdminHandler(svc *service.AdminService) *AdminHandler {
	return &AdminHandler{svc: svc}
}

func (h *AdminHandler) Stats(c *gin.Context) {
	stats, err := h.svc.GetStats(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Failed to get stats")
		return
	}
	response.OK(c, stats)
}

func (h *AdminHandler) UploadTrend(c *gin.Context) {
	trend, err := h.svc.GetUploadTrend(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Failed to get upload trend")
		return
	}
	response.OK(c, trend)
}

func (h *AdminHandler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")

	users, total, err := h.svc.ListUsers(c.Request.Context(), page, limit, search)
	if err != nil {
		response.InternalError(c, "Failed to list users")
		return
	}
	response.OK(c, gin.H{"items": users, "total": total, "page": page, "limit": limit})
}

type updateUserReq struct {
	Role string `json:"role" binding:"required,oneof=user admin"`
}

func (h *AdminHandler) UpdateUser(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid user ID")
		return
	}
	var req updateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateUserRole(c.Request.Context(), id, req.Role); err != nil {
		response.InternalError(c, "Failed to update user")
		return
	}
	response.OK(c, nil)
}

func (h *AdminHandler) ListImages(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")
	userID, _ := strconv.ParseInt(c.DefaultQuery("user_id", "0"), 10, 64)

	images, total, err := h.svc.ListAllImages(c.Request.Context(), page, limit, search, userID)
	if err != nil {
		response.InternalError(c, "Failed to list images")
		return
	}
	response.OK(c, gin.H{"items": images, "total": total, "page": page, "limit": limit})
}

func (h *AdminHandler) TagStats(c *gin.Context) {
	stats, err := h.svc.GetTagStats(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Failed to get tag stats")
		return
	}
	response.OK(c, stats)
}

func (h *AdminHandler) SyncTag(c *gin.Context) {
	tagName := c.Query("tag")
	if tagName == "" { tagName = "打印" }
	added, removed, err := h.svc.SyncTaggedImages(c.Request.Context(), tagName, "/exports")
	if err != nil {
		response.InternalError(c, "sync failed: "+err.Error())
		return
	}
	response.OK(c, gin.H{"added": added, "removed": removed, "tag": tagName})
}

func (h *AdminHandler) SyncStatus(c *gin.Context) {
	response.OK(c, gin.H{"last_sync": h.svc.LastSync(), "interval": "5m"})
}

func (h *AdminHandler) DeleteImage(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid image ID")
		return
	}
	if err := h.svc.ForceDeleteImage(c.Request.Context(), id); err != nil {
		response.InternalError(c, "Failed to delete image")
		return
	}
	response.OK(c, nil)
}
