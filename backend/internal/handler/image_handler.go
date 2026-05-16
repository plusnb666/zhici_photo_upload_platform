package handler

import (
	"fmt"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/nbplus/image_upload_platform/internal/service"
	"github.com/nbplus/image_upload_platform/pkg/response"
)

type ImageHandler struct {
	svc *service.ImageService
}

func NewImageHandler(svc *service.ImageService) *ImageHandler {
	return &ImageHandler{svc: svc}
}

func (h *ImageHandler) Upload(c *gin.Context) {
	userID := c.GetInt64("user_id")
	isAdmin := c.GetString("role") == "admin"

	form, err := c.MultipartForm()
	if err != nil {
		response.BadRequest(c, "Invalid multipart form")
		return
	}

	files := form.File["files"]
	if len(files) == 0 {
		response.BadRequest(c, "No files provided")
		return
	}

	tagsStr := c.PostForm("tags")
	var tags []string
	if tagsStr != "" {
		_ = tagsStr
	}

	var uploaded []gin.H
	for _, fh := range files {
		file, err := fh.Open()
		if err != nil {
			continue
		}
		defer file.Close()

		img, err := h.svc.Upload(c.Request.Context(), userID, isAdmin, fh.Filename, file, fh.Size, fh.Header.Get("Content-Type"), tags)
		if err != nil {
			response.Error(c, 400, 40001, err.Error())
			return
		}
		uploaded = append(uploaded, gin.H{
			"id":        img.ID,
			"filename":  img.Filename,
			"url":       img.URL,
			"thumb_url": img.ThumbURL,
			"file_size": img.FileSize,
		})
	}

	response.Created(c, gin.H{"images": uploaded})
}

func (h *ImageHandler) ListPublic(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")
	tag := c.Query("tag")
	sort := c.Query("sort")

	images, total, err := h.svc.ListPublicImages(c.Request.Context(), page, limit, search, tag, sort)
	if err != nil {
		response.InternalError(c, "Failed to list images")
		return
	}
	response.OK(c, gin.H{"items": images, "total": total, "page": page, "limit": limit})
}

func (h *ImageHandler) ToggleTag(c *gin.Context) {
	userID := c.GetInt64("user_id")
	imageID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid image ID")
		return
	}
	var body struct {
		TagID int64 `json:"tag_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	added, err := h.svc.ToggleTag(c.Request.Context(), imageID, body.TagID, userID)
	if err != nil {
		response.InternalError(c, "Failed to toggle tag")
		return
	}
	response.OK(c, gin.H{"added": added})
}

func (h *ImageHandler) GetPublic(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid image ID")
		return
	}
	img, err := h.svc.GetPublicImage(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Image not found")
		return
	}
	response.OK(c, img)
}

func (h *ImageHandler) List(c *gin.Context) {
	userID := c.GetInt64("user_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")
	tag := c.Query("tag")
	sort := c.Query("sort")

	images, total, err := h.svc.ListImages(c.Request.Context(), userID, page, limit, search, tag, sort)
	if err != nil {
		response.InternalError(c, "Failed to list images")
		return
	}
	response.OK(c, gin.H{
		"items": images,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *ImageHandler) Get(c *gin.Context) {
	userID := c.GetInt64("user_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid image ID")
		return
	}
	img, err := h.svc.GetImage(c.Request.Context(), userID, id)
	if err != nil {
		response.NotFound(c, "Image not found")
		return
	}
	response.OK(c, img)
}

func (h *ImageHandler) Download(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid image ID")
		return
	}
	img, err := h.svc.GetImage(c.Request.Context(), 0, id)
	if err != nil {
		response.NotFound(c, "Image not found")
		return
	}
	data, mime, err := h.svc.DownloadFile(c.Request.Context(), img.StorageKey)
	if err != nil {
		response.InternalError(c, "Failed to download file")
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, img.Filename))
	c.Data(200, mime, data)
}

func (h *ImageHandler) Delete(c *gin.Context) {
	userID := c.GetInt64("user_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid image ID")
		return
	}
	if err := h.svc.SoftDelete(c.Request.Context(), userID, id); err != nil {
		response.Error(c, 404, 40401, "Image not found")
		return
	}
	response.OK(c, nil)
}

func (h *ImageHandler) Update(c *gin.Context) {
	userID := c.GetInt64("user_id")
	isAdmin := c.GetString("role") == "admin"
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid image ID")
		return
	}
	var body struct {
		Filename *string `json:"filename"`
		AltText  *string `json:"alt_text"`
		IsPublic *bool   `json:"is_public"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	img, err := h.svc.UpdateImage(c.Request.Context(), userID, id, isAdmin, body.Filename, body.AltText)
	if err != nil {
		if err.Error() == "permission denied" {
			response.Forbidden(c, "Cannot edit this image")
			return
		}
		if err.Error() == "image not found" {
			response.NotFound(c, "Image not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, img)
}

func (h *ImageHandler) AddTags(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid image ID")
		return
	}
	if !h.svc.IsImagePublic(c.Request.Context(), id) {
		response.Forbidden(c, "Cannot tag private images")
		return
	}
	var body struct {
		TagNames []string `json:"tag_names" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.svc.AddTags(c.Request.Context(), id, body.TagNames); err != nil {
		response.InternalError(c, "Failed to add tags")
		return
	}
	response.OK(c, nil)
}

func (h *ImageHandler) RemoveTag(c *gin.Context) {
	imageID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid image ID")
		return
	}
	if !h.svc.IsImagePublic(c.Request.Context(), imageID) {
		response.Forbidden(c, "Cannot modify tags on private images")
		return
	}
	tagID, err := strconv.ParseInt(c.Param("tagId"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid tag ID")
		return
	}
	if err := h.svc.RemoveTag(c.Request.Context(), imageID, tagID); err != nil {
		response.InternalError(c, "Failed to remove tag")
		return
	}
	response.OK(c, nil)
}

func (h *ImageHandler) BatchDelete(c *gin.Context) {
	userID := c.GetInt64("user_id")
	var body struct {
		IDs []int64 `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	for _, id := range body.IDs {
		_ = h.svc.SoftDelete(c.Request.Context(), userID, id)
	}
	response.OK(c, nil)
}
