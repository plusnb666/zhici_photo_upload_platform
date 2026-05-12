// 领域实体：Image
// 核心实体，包含图片的所有元数据
// URL/ThumbURL/DownURL 由 service.fillURLs() 在查询后动态填充，不存储在数据库中
package domain

import "time"

type Image struct {
	ID           int64      `json:"id"`
	UserID       int64      `json:"user_id"`      // 上传者
	Filename     string     `json:"filename"`      // 用户上传时的原始文件名
	StorageKey   string     `json:"storage_key"`   // MinIO/S3 对象 key，格式: {userID}/{safeName}_{ts}{ext}
	MimeType     string     `json:"mime_type"`     // 如 image/jpeg
	FileSize     int64      `json:"file_size"`     // 字节
	Width        *int       `json:"width"`         // 图片宽度（上传时从 EXIF 提取）
	Height       *int       `json:"height"`        // 图片高度
	ThumbnailKey *string    `json:"thumbnail_key"` // 缩略图在 MinIO 中的 key，格式: {storageKey}_thumb.jpg
	AltText      *string    `json:"alt_text"`      // 无障碍替代文本
	ViewCount    int64      `json:"view_count"`    // 浏览次数
	IsPublic     bool       `json:"is_public"`     // 是否公开可见（所有上传默认 true）
	DeletedAt    *time.Time `json:"deleted_at"`    // 软删除时间戳
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`

	// ── 以下为查询时 JOIN 填充的字段，不存储在 images 表中 ──
	Username string  `json:"username,omitempty"`      // 上传者用户名（JOIN users）
	Tags     []Tag   `json:"tags,omitempty"`          // 关联标签（JOIN image_tags + tags）
	URL      string  `json:"url,omitempty"`           // 原始图 URL（CDN 或预签名地址）
	ThumbURL string  `json:"thumbnail_url,omitempty"` // 缩略图 URL
	DownURL  string  `json:"download_url,omitempty"`  // 下载 URL
}
