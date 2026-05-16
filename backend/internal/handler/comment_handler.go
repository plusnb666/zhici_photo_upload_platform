package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/nbplus/image_upload_platform/internal/service"
	"github.com/nbplus/image_upload_platform/pkg/response"
)

type CommentHandler struct {
	svc *service.CommentService
}

func NewCommentHandler(svc *service.CommentService) *CommentHandler {
	return &CommentHandler{svc: svc}
}

func (h *CommentHandler) List(c *gin.Context) {
	imageID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid image ID")
		return
	}
	comments, err := h.svc.List(c.Request.Context(), imageID)
	if err != nil {
		response.InternalError(c, "Failed to load comments")
		return
	}
	response.OK(c, comments)
}

func (h *CommentHandler) Create(c *gin.Context) {
	imageID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid image ID")
		return
	}
	userID := c.GetInt64("user_id")
	var body struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "Content required")
		return
	}
	comment, err := h.svc.Create(c.Request.Context(), imageID, userID, body.Content)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, comment)
}

func (h *CommentHandler) Delete(c *gin.Context) {
	commentID, err := strconv.ParseInt(c.Param("cid"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid comment ID")
		return
	}
	userID := c.GetInt64("user_id")
	isAdmin := c.GetString("role") == "admin"
	if err := h.svc.Delete(c.Request.Context(), commentID, userID, isAdmin); err != nil {
		if err.Error() == "permission denied" {
			response.Forbidden(c, "Cannot delete this comment")
			return
		}
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, nil)
}
