// 领域实体：User 和 RefreshToken
// 纯数据结构，不包含业务逻辑，不依赖任何外部包（除 time）
package domain

import "time"

// User 用户实体
// json:"-" 标记的字段不会序列化到 API 响应中
type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`        // bcrypt 哈希，绝对不返回给客户端
	Role         string    `json:"role"`      // "user" | "admin"
	AvatarURL    *string   `json:"avatar_url"`
	StorageUsed  int64     `json:"storage_used"` // 已用存储空间（字节）
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// RefreshToken 刷新令牌实体
// 存储在数据库中，支持服务端吊销（用户登出时标记 revoked=true）
type RefreshToken struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	TokenHash string    `json:"-"`         // SHA-256 哈希，不返回给客户端
	ExpiresAt time.Time `json:"expires_at"` // 默认 7 天
	Revoked   bool      `json:"revoked"`    // 是否已吊销
	CreatedAt time.Time `json:"created_at"`
}
