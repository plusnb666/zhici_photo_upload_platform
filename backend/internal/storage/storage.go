// 对象存储抽象层
// 开发环境使用 MinIO（兼容 S3 API），生产环境切换为阿里云 OSS / AWS S3 / Cloudflare R2
// 切换只需修改环境变量，代码零改动
package storage

import (
	"context"
	"io"
)

// FileStorage 定义对象存储操作接口
// 实现类：S3Storage（MinIO/S3/OSS）、LocalStorage（本地文件系统，仅用于开发兜底）
type FileStorage interface {
	// Upload 上传文件到指定 key（路径）
	Upload(ctx context.Context, key string, reader io.Reader, size int64, contentType string) error

	// Delete 删除指定 key 的文件
	Delete(ctx context.Context, key string) error

	// GetPresignedURL 生成预签名下载 URL，有效期 expirySeconds 秒
	// 生产环境通常通过 CDN_BASE_URL 替代此方法返回 CDN 地址
	GetPresignedURL(ctx context.Context, key string, expirySeconds int64) (string, error)
}
