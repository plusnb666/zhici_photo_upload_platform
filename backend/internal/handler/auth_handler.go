package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/nbplus/image_upload_platform/internal/service"
	"github.com/nbplus/image_upload_platform/pkg/response"
)

type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

type registerReq struct {
	Username string `json:"username" binding:"required,min=2,max=64"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	user, err := h.svc.Register(c.Request.Context(), req.Username, req.Email, req.Password)
	if err != nil {
		if err == service.ErrUserExists {
			response.Error(c, http.StatusConflict, 40900, "User already exists")
			return
		}
		response.InternalError(c, "Registration failed")
		return
	}
	response.Created(c, gin.H{"user": user})
}

type loginReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	user, accessToken, refreshToken, err := h.svc.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		if err == service.ErrInvalidCreds {
			response.Unauthorized(c, "Invalid email or password")
			return
		}
		response.InternalError(c, "Login failed")
		return
	}
	response.OK(c, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"user":          user,
	})
}

type refreshReq struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req refreshReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	accessToken, newRefreshToken, err := h.svc.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		response.Unauthorized(c, "Invalid refresh token")
		return
	}
	response.OK(c, gin.H{
		"access_token":  accessToken,
		"refresh_token": newRefreshToken,
	})
}

type logoutReq struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *AuthHandler) Logout(c *gin.Context) {
	var req logoutReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	_ = h.svc.Logout(c.Request.Context(), req.RefreshToken)
	response.OK(c, nil)
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := c.GetInt64("user_id")
	user, err := h.svc.GetUser(c.Request.Context(), userID)
	if err != nil || user == nil {
		response.NotFound(c, "User not found")
		return
	}
	response.OK(c, user)
}
