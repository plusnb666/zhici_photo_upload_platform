// 配置模块：从环境变量读取所有配置，遵循 12-Factor App 原则
// 每个配置项都有合理的默认值，方便本地开发，生产环境通过环境变量覆盖
package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config 聚合所有运行参数，由 Load() 在启动时一次性创建
type Config struct {
	// ── 应用 ──
	AppEnv  string // "development" | "production"，影响日志格式
	AppPort string // HTTP 监听端口，默认 8080

	// ── PostgreSQL ──
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	// ── Redis ──
	RedisHost string
	RedisPort string

	// ── 对象存储（MinIO / S3 / OSS）──
	S3Endpoint  string // 服务地址，如 minio:9000 或 oss-cn-shanghai.aliyuncs.com
	S3AccessKey string
	S3SecretKey string
	S3Bucket    string // bucket 名称，默认 "images"
	S3UseSSL    bool   // 是否使用 HTTPS 连接

	// ── 安全 ──
	JWTSecret string // JWT 签名密钥，生产必须更换

	// ── CDN ──
	CDNBaseURL string // CDN 前缀，如 http://47.116.137.143:8080/images。为空时使用 S3 预签名 URL

	// ── 限制 ──
	UploadMaxSizeMB int64 // 单文件上传上限（MB），0 表示不限制
	StorageQuotaGB  int64 // 普通用户存储配额（GB），默认 5GB（admin 无限制）
}

// Load 从环境变量构建 Config，未设置的变量使用默认值
func Load() *Config {
	return &Config{
		AppEnv:  getEnv("APP_ENV", "development"),
		AppPort: getEnv("APP_PORT", "8080"),

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "imgplatform"),
		DBPassword: getEnv("DB_PASSWORD", "devpassword"),
		DBName:     getEnv("DB_NAME", "imgplatform"),

		RedisHost: getEnv("REDIS_HOST", "localhost"),
		RedisPort: getEnv("REDIS_PORT", "6379"),

		S3Endpoint:  getEnv("S3_ENDPOINT", "localhost:9000"),
		S3AccessKey: getEnv("S3_ACCESS_KEY", "minioadmin"),
		S3SecretKey: getEnv("S3_SECRET_KEY", "minioadmin"),
		S3Bucket:    getEnv("S3_BUCKET", "images"),
		S3UseSSL:    getEnvBool("S3_USE_SSL", false),

		JWTSecret:  getEnv("JWT_SECRET", "change-me"),
		CDNBaseURL: getEnv("CDN_BASE_URL", ""),

		UploadMaxSizeMB: getEnvInt64("UPLOAD_MAX_SIZE_MB", 0),
		StorageQuotaGB:  getEnvInt64("STORAGE_QUOTA_GB", 5),
	}
}

// DSN 返回 PostgreSQL 连接字符串
func (c *Config) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName)
}

// RedisAddr 返回 Redis 地址
func (c *Config) RedisAddr() string {
	return fmt.Sprintf("%s:%s", c.RedisHost, c.RedisPort)
}

// ── 环境变量读取辅助函数 ──

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return fallback
		}
		return b
	}
	return fallback
}

func getEnvInt64(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return fallback
		}
		return n
	}
	return fallback
}
