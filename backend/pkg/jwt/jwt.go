// JWT 令牌工具包
// 双令牌机制：
//   - Access Token：15 分钟有效期，HMAC-SHA256 签名，每次请求携带
//   - Refresh Token：7 天有效期，数据库存储 + SHA-256 哈希，支持服务端吊销
package jwt

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
)

var (
	ErrTokenExpired = errors.New("token expired")
	ErrTokenInvalid = errors.New("token invalid")
)

// Claims JWT 负载，包含用户 ID 和角色
type Claims struct {
	UserID int64  `json:"user_id"`
	Role   string `json:"role"` // "user" | "admin"
	jwtlib.RegisteredClaims
}

// GenerateAccessToken 签发 access token（15 分钟有效）
func GenerateAccessToken(secret string, userID int64, role string) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwtlib.RegisteredClaims{
			ExpiresAt: jwtlib.NewNumericDate(time.Now().Add(15 * time.Minute)), // 15 分钟后过期
			IssuedAt:  jwtlib.NewNumericDate(time.Now()),
		},
	}
	token := jwtlib.NewWithClaims(jwtlib.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// GenerateRefreshTokenBytes 生成随机 refresh token 字符串
// TODO: 生产环境应使用 crypto/rand 替代时间戳
func GenerateRefreshTokenBytes() (string, error) {
	return fmt.Sprintf("%x", time.Now().UnixNano()), nil
}

// HashToken 对 token 做 SHA-256 哈希，用于存入数据库
func HashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// ValidateAccessToken 验证 access token 并返回负载
func ValidateAccessToken(secret string, tokenStr string) (*Claims, error) {
	token, err := jwtlib.ParseWithClaims(tokenStr, &Claims{}, func(t *jwtlib.Token) (interface{}, error) {
		// 防止算法混淆攻击：只接受 HMAC 签名的 token
		if _, ok := t.Method.(*jwtlib.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		if errors.Is(err, jwtlib.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrTokenInvalid
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrTokenInvalid
	}
	return claims, nil
}
