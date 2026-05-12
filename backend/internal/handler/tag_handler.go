package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/nbplus/image_upload_platform/internal/service"
	"github.com/nbplus/image_upload_platform/pkg/response"
)

type TagHandler struct {
	svc *service.TagService
}

func NewTagHandler(svc *service.TagService) *TagHandler {
	return &TagHandler{svc: svc}
}

func (h *TagHandler) List(c *gin.Context) {
	search := c.Query("search")
	tags, err := h.svc.List(c.Request.Context(), search)
	if err != nil {
		response.InternalError(c, "Failed to list tags")
		return
	}
	response.OK(c, gin.H{"items": tags})
}

type createTagReq struct {
	Name  string `json:"name" binding:"required,min=1,max=64"`
	Color string `json:"color"`
}

func (h *TagHandler) Create(c *gin.Context) {
	var req createTagReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	tag, err := h.svc.Create(c.Request.Context(), req.Name, req.Color)
	if err != nil {
		response.InternalError(c, "Failed to create tag")
		return
	}
	response.Created(c, tag)
}

func (h *TagHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid tag ID")
		return
	}
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.InternalError(c, "Failed to delete tag")
		return
	}
	response.OK(c, nil)
}
