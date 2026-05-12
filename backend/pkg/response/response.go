// 统一 JSON 响应格式
// 所有 API 响应都使用相同的信封结构：
//
//	{ "code": 0, "message": "success", "data": { ... } }
//	{ "code": 40100, "message": "Invalid token", "data": null }
//
// 错误码规则：{http_status}{序号}，如 40100 = 401 + 序号 00
package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response API 统一响应信封
type Response struct {
	Code    int         `json:"code"`    // 业务状态码，0 表示成功
	Message string      `json:"message"` // 提示信息
	Data    interface{} `json:"data"`    // 响应数据，错误时为 nil
}

// OK 成功响应 (HTTP 200)
func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

// Created 创建成功响应 (HTTP 201)，用于 POST 新建资源
func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Response{Code: 0, Message: "created", Data: data})
}

// Error 通用错误响应，允许自定义 HTTP 状态码和业务错误码
func Error(c *gin.Context, httpStatus int, code int, message string) {
	c.JSON(httpStatus, Response{Code: code, Message: message, Data: nil})
}

// ── 常用错误快捷方法 ──

func BadRequest(c *gin.Context, message string)  { Error(c, http.StatusBadRequest, 40000, message) }
func Unauthorized(c *gin.Context, message string) { Error(c, http.StatusUnauthorized, 40100, message) }
func Forbidden(c *gin.Context, message string)    { Error(c, http.StatusForbidden, 40300, message) }
func NotFound(c *gin.Context, message string)     { Error(c, http.StatusNotFound, 40400, message) }
func TooManyRequests(c *gin.Context, message string) {
	Error(c, http.StatusTooManyRequests, 42900, message)
}
func InternalError(c *gin.Context, message string) { Error(c, http.StatusInternalServerError, 50000, message) }
