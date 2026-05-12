// S3 兼容存储实现
// 基于 minio-go SDK，同时支持 MinIO、AWS S3、阿里云 OSS、腾讯云 COS、Cloudflare R2
// 只需修改 endpoint + accessKey + secretKey 即可切换
package storage

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// S3Storage 封装 minio.Client，实现 FileStorage 接口
type S3Storage struct {
	client     *minio.Client
	bucketName string
}

// NewS3Storage 创建 S3 兼容存储客户端
// endpoint: MinIO 地址如 minio:9000，或云 OSS 地址
// useSSL: 生产环境应设为 true
func NewS3Storage(endpoint, accessKey, secretKey, bucket string, useSSL bool) (*S3Storage, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create minio client: %w", err)
	}
	return &S3Storage{client: client, bucketName: bucket}, nil
}

// Upload 上传文件到 bucket。key 格式为 "{userID}/{safeFilename}_{timestamp}{ext}"
func (s *S3Storage) Upload(ctx context.Context, key string, reader io.Reader, size int64, contentType string) error {
	_, err := s.client.PutObject(ctx, s.bucketName, key, reader, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	return err
}

// Delete 从 bucket 中删除对象
func (s *S3Storage) Delete(ctx context.Context, key string) error {
	return s.client.RemoveObject(ctx, s.bucketName, key, minio.RemoveObjectOptions{})
}

// GetPresignedURL 生成预签名下载 URL。有效期由调用方指定（通常 15 分钟 ~ 1 小时）
// 注意：预签名 URL 包含内部 endpoint，浏览器直接访问可能不通
// 生产环境优先使用 CDN_BASE_URL 拼接而非预签名 URL
func (s *S3Storage) GetPresignedURL(ctx context.Context, key string, expirySeconds int64) (string, error) {
	u, err := s.client.PresignedGetObject(ctx, s.bucketName, key, time.Duration(expirySeconds)*time.Second, nil)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}
