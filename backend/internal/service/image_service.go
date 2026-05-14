package service

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/disintegration/imaging"
	_ "golang.org/x/image/webp"

	"github.com/nbplus/image_upload_platform/internal/domain"
	"github.com/nbplus/image_upload_platform/internal/storage"
)

var (
	allowedMimeTypes = map[string]bool{
		"image/png":  true,
		"image/jpeg": true,
		"image/gif":  true,
		"image/webp": true,
		"image/bmp":  true,
	}
	filenameRe = regexp.MustCompile(`[^a-zA-Z0-9._-]`)
)

type ImageService struct {
	db        *pgxpool.Pool
	storage   storage.FileStorage
	cdnURL    string
	maxSizeMB int64
	quotaGB   int64
}

func NewImageService(db *pgxpool.Pool, st storage.FileStorage, cdnURL string, maxSizeMB, quotaGB int64) *ImageService {
	return &ImageService{db: db, storage: st, cdnURL: cdnURL, maxSizeMB: maxSizeMB, quotaGB: quotaGB}
}

func (s *ImageService) Upload(ctx context.Context, userID int64, isAdmin bool, filename string, file io.Reader, size int64, mimeType string, tags []string) (*domain.Image, error) {
	if s.maxSizeMB > 0 && size > s.maxSizeMB*1024*1024 {
		return nil, fmt.Errorf("file too large: max %dMB", s.maxSizeMB)
	}

	// Read entire file into memory
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}
	actualSize := int64(len(fileBytes))

	// Detect actual MIME type from content
	detectedMime := http.DetectContentType(fileBytes)
	if detectedMime != mimeType && detectedMime != "application/octet-stream" {
		mimeType = detectedMime
	}
	if !allowedMimeTypes[mimeType] {
		return nil, fmt.Errorf("unsupported file type: %s", mimeType)
	}

	// Check quota (admin has no limit)
	if !isAdmin {
		var storageUsed int64
		err = s.db.QueryRow(ctx, `SELECT storage_used FROM users WHERE id = $1`, userID).Scan(&storageUsed)
		if err != nil {
			return nil, err
		}
		if storageUsed+actualSize > s.quotaGB*1024*1024*1024 {
			return nil, fmt.Errorf("storage quota exceeded: %dGB", s.quotaGB)
		}
	}

	// Decode image dimensions
	var width, height *int
	imgCfg, _, err := image.DecodeConfig(bytes.NewReader(fileBytes))
	if err == nil {
		w := imgCfg.Width
		h := imgCfg.Height
		width = &w
		height = &h
	}

	safeName := filenameRe.ReplaceAllString(filename, "_")
	ext := filepath.Ext(safeName)
	key := fmt.Sprintf("%d/%s_%d%s", userID, safeName[:len(safeName)-len(ext)], time.Now().UnixNano(), ext)

	// Upload original
	if err := s.storage.Upload(ctx, key, bytes.NewReader(fileBytes), actualSize, mimeType); err != nil {
		return nil, fmt.Errorf("upload failed: %w", err)
	}

	// Generate thumbnail
	var thumbKey *string
	if img, err := imaging.Decode(bytes.NewReader(fileBytes), imaging.AutoOrientation(true)); err == nil {
		thumb := imaging.Fit(img, 300, 300, imaging.Lanczos)
		var thumbOut bytes.Buffer
		if err := imaging.Encode(&thumbOut, thumb, imaging.JPEG, imaging.JPEGQuality(80)); err == nil {
			tk := key + "_thumb.jpg"
			if err := s.storage.Upload(ctx, tk, &thumbOut, int64(thumbOut.Len()), "image/jpeg"); err == nil {
				thumbKey = &tk
			}
		}
	}

	isPublic := true

	var img domain.Image
	err = s.db.QueryRow(ctx,
		`INSERT INTO images (user_id, filename, storage_key, mime_type, file_size, width, height, thumbnail_key, is_public)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, user_id, filename, storage_key, mime_type, file_size,
		           width, height, thumbnail_key, view_count, is_public, created_at`,
		userID, filename, key, mimeType, actualSize, width, height, thumbKey, isPublic,
	).Scan(&img.ID, &img.UserID, &img.Filename, &img.StorageKey, &img.MimeType, &img.FileSize,
		&img.Width, &img.Height, &img.ThumbnailKey, &img.ViewCount, &img.IsPublic, &img.CreatedAt)
	if err != nil {
		s.storage.Delete(ctx, key)
		if thumbKey != nil {
			s.storage.Delete(ctx, *thumbKey)
		}
		return nil, err
	}

	_, _ = s.db.Exec(ctx, `UPDATE users SET storage_used = storage_used + $1, updated_at = NOW() WHERE id = $2`, actualSize, userID)

	// Add tags
	for _, tagName := range tags {
		s.addTagToImage(ctx, img.ID, tagName)
	}

	s.fillURLs(&img)
	return &img, nil
}

func (s *ImageService) GetImage(ctx context.Context, userID int64, imageID int64) (*domain.Image, error) {
	var img domain.Image
	err := s.db.QueryRow(ctx,
		`SELECT i.id, i.user_id, i.filename, i.storage_key, i.mime_type, i.file_size,
		        i.width, i.height, i.thumbnail_key, i.alt_text, i.view_count, i.is_public,
		        i.deleted_at, i.created_at, u.username
		 FROM images i JOIN users u ON i.user_id = u.id
		 WHERE i.id = $1 AND i.deleted_at IS NULL`, imageID,
	).Scan(&img.ID, &img.UserID, &img.Filename, &img.StorageKey, &img.MimeType, &img.FileSize,
		&img.Width, &img.Height, &img.ThumbnailKey, &img.AltText, &img.ViewCount, &img.IsPublic,
		&img.DeletedAt, &img.CreatedAt, &img.Username)
	if err != nil {
		return nil, err
	}

	img.Tags, _ = s.getImageTagsForUser(ctx, imageID, userID)
	s.fillURLs(&img)
	return &img, nil
}

func (s *ImageService) ListImages(ctx context.Context, userID int64, page, limit int, search, tag, sort string) ([]domain.Image, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	var args []interface{}
	where := "WHERE i.deleted_at IS NULL AND i.user_id = $1"
	args = append(args, userID)
	argIdx := 2

	if search != "" {
		where += fmt.Sprintf(" AND (i.filename ILIKE $%d OR i.alt_text ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if tag != "" {
		where += fmt.Sprintf(` AND i.id IN (SELECT it.image_id FROM image_tags it JOIN tags t ON it.tag_id = t.id WHERE t.name = $%d)`, argIdx)
		args = append(args, tag)
		argIdx++
	}

	orderBy := "ORDER BY i.created_at DESC"
	switch sort {
	case "file_size":
		orderBy = "ORDER BY i.file_size DESC"
	case "view_count":
		orderBy = "ORDER BY i.view_count DESC"
	}

	var total int64
	countQ := fmt.Sprintf("SELECT COUNT(*) FROM images i %s", where)
	s.db.QueryRow(ctx, countQ, args...).Scan(&total)

	query := fmt.Sprintf(`SELECT i.id, i.user_id, i.filename, i.storage_key, i.mime_type, i.file_size,
		i.width, i.height, i.thumbnail_key, i.view_count, i.created_at
		FROM images i %s %s LIMIT $%d OFFSET $%d`, where, orderBy, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var images []domain.Image
	for rows.Next() {
		var img domain.Image
		if err := rows.Scan(&img.ID, &img.UserID, &img.Filename, &img.StorageKey, &img.MimeType,
			&img.FileSize, &img.Width, &img.Height, &img.ThumbnailKey, &img.ViewCount, &img.CreatedAt); err != nil {
			return nil, 0, err
		}
		img.Tags, _ = s.getImageTags(ctx, img.ID)
		s.fillURLs(&img)
		images = append(images, img)
	}
	return images, total, nil
}

func (s *ImageService) SoftDelete(ctx context.Context, userID int64, imageID int64) error {
	return s.HardDelete(ctx, userID, imageID)
}

func (s *ImageService) HardDelete(ctx context.Context, userID int64, imageID int64) error {
	var img domain.Image
	err := s.db.QueryRow(ctx,
		`DELETE FROM images
		 WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
		 RETURNING id, file_size, storage_key, thumbnail_key`, imageID, userID,
	).Scan(&img.ID, &img.FileSize, &img.StorageKey, &img.ThumbnailKey)
	if err != nil {
		return err
	}
	s.storage.Delete(ctx, img.StorageKey)
	if img.ThumbnailKey != nil && *img.ThumbnailKey != "" {
		s.storage.Delete(ctx, *img.ThumbnailKey)
	}
	_, _ = s.db.Exec(ctx, `UPDATE users SET storage_used = GREATEST(storage_used - $1, 0), updated_at = NOW() WHERE id = $2`, img.FileSize, userID)
	return nil
}

func (s *ImageService) AddTags(ctx context.Context, imageID int64, tagNames []string) error {
	for _, name := range tagNames {
		s.addTagToImage(ctx, imageID, name)
	}
	return nil
}

func (s *ImageService) RemoveTag(ctx context.Context, imageID, tagID int64) error {
	_, err := s.db.Exec(ctx, `DELETE FROM image_tags WHERE image_id = $1 AND tag_id = $2`, imageID, tagID)
	return err
}

func (s *ImageService) ToggleTag(ctx context.Context, imageID, tagID, userID int64) (added bool, err error) {
	tag, err := s.db.Exec(ctx,
		`DELETE FROM image_tags WHERE image_id = $1 AND tag_id = $2 AND user_id = $3`,
		imageID, tagID, userID,
	)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() > 0 {
		return false, nil // removed
	}
	_, err = s.db.Exec(ctx,
		`INSERT INTO image_tags (image_id, tag_id, user_id) VALUES ($1, $2, $3)`,
		imageID, tagID, userID,
	)
	if err != nil {
		return false, err
	}
	return true, nil // added
}

func (s *ImageService) GetDownloadURL(ctx context.Context, key string) (string, error) {
	return s.storage.GetPresignedURL(ctx, key, 900)
}

func (s *ImageService) DownloadFile(ctx context.Context, key string) ([]byte, string, error) {
	url, err := s.storage.GetPresignedURL(ctx, key, 900)
	if err != nil {
		return nil, "", err
	}
	resp, err := http.Get(url)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}
	return data, resp.Header.Get("Content-Type"), nil
}

func (s *ImageService) fillURLs(img *domain.Image) {
	base := s.cdnURL
	if base == "" {
		return
	}
	if img.StorageKey != "" {
		img.URL = base + "/" + img.StorageKey
		img.DownURL = base + "/" + img.StorageKey
	}
	if img.ThumbnailKey != nil && *img.ThumbnailKey != "" {
		img.ThumbURL = base + "/" + *img.ThumbnailKey
	}
}

func (s *ImageService) addTagToImage(ctx context.Context, imageID int64, tagName string) {
	tagName = strings.TrimSpace(tagName)
	if tagName == "" {
		return
	}
	// Upsert tag
	var tagID int64
	err := s.db.QueryRow(ctx,
		`INSERT INTO tags (name) VALUES ($1)
		 ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
		 RETURNING id`, tagName,
	).Scan(&tagID)
	if err != nil {
		return
	}
	// Link
	_, _ = s.db.Exec(ctx,
		`INSERT INTO image_tags (image_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		imageID, tagID,
	)
}

func (s *ImageService) getImageTags(ctx context.Context, imageID int64) ([]domain.Tag, error) {
	return s.getImageTagsForUser(ctx, imageID, 0)
}

func (s *ImageService) getImageTagsForUser(ctx context.Context, imageID, userID int64) ([]domain.Tag, error) {
	rows, err := s.db.Query(ctx,
		`SELECT t.id, t.name, t.color, t.created_at, COUNT(it.user_id) as cnt,
		        BOOL_OR(it.user_id = $2) as active
		 FROM tags t JOIN image_tags it ON t.id = it.tag_id
		 WHERE it.image_id = $1
		 GROUP BY t.id, t.name, t.color, t.created_at
		 ORDER BY cnt DESC`,
		imageID, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []domain.Tag
	for rows.Next() {
		var t domain.Tag
		var active bool
		if err := rows.Scan(&t.ID, &t.Name, &t.Color, &t.CreatedAt, &t.Count, &active); err != nil {
			return nil, err
		}
		if userID > 0 {
			t.Active = active
		}
		tags = append(tags, t)
	}
	return tags, nil
}

func (s *ImageService) ListPublicImages(ctx context.Context, page, limit int, search, tag, sort string) ([]domain.Image, int64, error) {
	if limit <= 0 || limit > 100 { limit = 20 }
	if page <= 0 { page = 1 }
	offset := (page - 1) * limit

	args := []interface{}{}
	where := "WHERE i.deleted_at IS NULL AND i.is_public = true"
	argIdx := 1

	if search != "" {
		where += fmt.Sprintf(" AND (i.filename ILIKE $%d OR i.alt_text ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if tag != "" {
		where += fmt.Sprintf(" AND i.id IN (SELECT it.image_id FROM image_tags it JOIN tags t ON it.tag_id = t.id WHERE t.name = $%d)", argIdx)
		args = append(args, tag)
		argIdx++
	}

	orderBy := "ORDER BY i.created_at DESC"
	switch sort {
	case "file_size": orderBy = "ORDER BY i.file_size DESC"
	case "view_count": orderBy = "ORDER BY i.view_count DESC"
	}

	var total int64
	s.db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM images i %s", where), args...).Scan(&total)

	query := fmt.Sprintf(`SELECT i.id, i.user_id, i.filename, i.storage_key, i.mime_type, i.file_size,
		i.width, i.height, i.thumbnail_key, i.view_count, i.created_at, u.username
		FROM images i JOIN users u ON i.user_id = u.id
		%s %s LIMIT $%d OFFSET $%d`, where, orderBy, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil { return nil, 0, err }
	defer rows.Close()

	var images []domain.Image
	for rows.Next() {
		var img domain.Image
		if err := rows.Scan(&img.ID, &img.UserID, &img.Filename, &img.StorageKey, &img.MimeType,
			&img.FileSize, &img.Width, &img.Height, &img.ThumbnailKey, &img.ViewCount, &img.CreatedAt, &img.Username); err != nil {
			return nil, 0, err
		}
		img.Tags, _ = s.getImageTags(ctx, img.ID)
		s.fillURLs(&img)
		images = append(images, img)
	}
	return images, total, nil
}

func (s *ImageService) GetPublicImage(ctx context.Context, imageID int64) (*domain.Image, error) {
	var img domain.Image
	err := s.db.QueryRow(ctx,
		`SELECT i.id, i.user_id, i.filename, i.storage_key, i.mime_type, i.file_size,
		        i.width, i.height, i.thumbnail_key, i.alt_text, i.view_count, i.is_public,
		        i.deleted_at, i.created_at, u.username
		 FROM images i JOIN users u ON i.user_id = u.id
		 WHERE i.id = $1 AND i.is_public = true AND i.deleted_at IS NULL`, imageID,
	).Scan(&img.ID, &img.UserID, &img.Filename, &img.StorageKey, &img.MimeType, &img.FileSize,
		&img.Width, &img.Height, &img.ThumbnailKey, &img.AltText, &img.ViewCount, &img.IsPublic,
		&img.DeletedAt, &img.CreatedAt, &img.Username)
	if err != nil { return nil, err }
	img.Tags, _ = s.getImageTags(ctx, imageID)
	s.fillURLs(&img)
	return &img, nil
}

func (s *ImageService) IsImagePublic(ctx context.Context, imageID int64) bool {
	var isPublic bool
	s.db.QueryRow(ctx, `SELECT is_public FROM images WHERE id = $1 AND deleted_at IS NULL`, imageID).Scan(&isPublic)
	return isPublic
}

// DetectContentType detects the actual MIME type from magic bytes
func DetectContentType(data []byte) string {
	return http.DetectContentType(data)
}

func (s *ImageService) SyncTaggedImages(ctx context.Context, tagName, exportDir string) (added, removed int, err error) {
	os.MkdirAll(exportDir, 0755)

	// Get all images with this tag
	rows, err := s.db.Query(ctx,
		`SELECT i.id, i.filename, i.storage_key, i.mime_type
		 FROM images i
		 JOIN image_tags it ON i.id = it.image_id
		 JOIN tags t ON t.id = it.tag_id
		 WHERE t.name = $1 AND i.deleted_at IS NULL`, tagName,
	)
	if err != nil { return 0, 0, err }
	defer rows.Close()

	kept := map[string]bool{}
	for rows.Next() {
		var id int64
		var filename, key, mime string
		if err := rows.Scan(&id, &filename, &key, &mime); err != nil {
			continue
		}
		outPath := filepath.Join(exportDir, filename)
		// Avoid overwrite if already exists with same size
		data, _, err := s.DownloadFile(ctx, key)
		if err != nil { continue }
		if err := os.WriteFile(outPath, data, 0644); err != nil { continue }
		kept[filename] = true
		added++
	}

	// Remove files no longer tagged
	entries, _ := os.ReadDir(exportDir)
	for _, e := range entries {
		if !e.IsDir() && !kept[e.Name()] {
			os.Remove(filepath.Join(exportDir, e.Name()))
			removed++
		}
	}
	return
}
