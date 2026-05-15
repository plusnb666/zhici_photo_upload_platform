package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nbplus/image_upload_platform/internal/domain"
	"github.com/nbplus/image_upload_platform/internal/storage"
)

type AdminService struct {
	db          *pgxpool.Pool
	fileStorage storage.FileStorage
	lastSync    time.Time
	mu          sync.RWMutex
}

func NewAdminService(db *pgxpool.Pool, fs storage.FileStorage) *AdminService {
	return &AdminService{db: db, fileStorage: fs}
}

func (s *AdminService) LastSync() time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastSync
}

func (s *AdminService) SyncTaggedImages(ctx context.Context, tagName, exportDir string) (added, removed int, err error) {
	os.MkdirAll(exportDir, 0755)

	rows, err := s.db.Query(ctx,
		`SELECT DISTINCT i.id, i.filename, i.storage_key
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
		var filename, key string
		if err := rows.Scan(&id, &filename, &key); err != nil {
			continue
		}
		outPath := filepath.Join(exportDir, filename)
		data, err := s.downloadFile(ctx, key)
		if err != nil { continue }
		if err := os.WriteFile(outPath, data, 0644); err != nil { continue }
		kept[filename] = true
		added++
	}

	entries, _ := os.ReadDir(exportDir)
	for _, e := range entries {
		if !e.IsDir() && !kept[e.Name()] {
			os.Remove(filepath.Join(exportDir, e.Name()))
			removed++
		}
	}

	s.mu.Lock()
	s.lastSync = time.Now()
	s.mu.Unlock()
	return
}

func (s *AdminService) downloadFile(ctx context.Context, key string) ([]byte, error) {
	url, err := s.fileStorage.GetPresignedURL(ctx, key, 900)
	if err != nil { return nil, err }
	resp, err := http.Get(url)
	if err != nil { return nil, err }
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

type DashboardStats struct {
	TotalUsers   int64 `json:"total_users"`
	TotalImages  int64 `json:"total_images"`
	TotalStorage int64 `json:"total_storage"`
	TodayUploads int64 `json:"today_uploads"`
}

type UploadTrend struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

func (s *AdminService) GetStats(ctx context.Context) (*DashboardStats, error) {
	var stats DashboardStats
	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role = 'user'`).Scan(&stats.TotalUsers)
	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM images WHERE deleted_at IS NULL`).Scan(&stats.TotalImages)
	s.db.QueryRow(ctx, `SELECT COALESCE(SUM(file_size), 0) FROM images WHERE deleted_at IS NULL`).Scan(&stats.TotalStorage)
	today := time.Now().Format("2006-01-02")
	s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM images WHERE deleted_at IS NULL AND created_at::date = $1`,
		today,
	).Scan(&stats.TodayUploads)
	return &stats, nil
}

func (s *AdminService) GetUploadTrend(ctx context.Context) ([]UploadTrend, error) {
	rows, err := s.db.Query(ctx,
		`SELECT to_char(d.date, 'YYYY-MM-DD') as date, COALESCE(COUNT(i.id), 0) as count
		 FROM generate_series(
		     CURRENT_DATE - INTERVAL '29 days',
		     CURRENT_DATE,
		     '1 day'::interval
		 ) d(date)
		 LEFT JOIN images i ON i.created_at::date = d.date AND i.deleted_at IS NULL
		 GROUP BY d.date ORDER BY d.date ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trend []UploadTrend
	for rows.Next() {
		var t UploadTrend
		if err := rows.Scan(&t.Date, &t.Count); err != nil {
			return nil, err
		}
		trend = append(trend, t)
	}
	return trend, nil
}

func (s *AdminService) ListUsers(ctx context.Context, page, limit int, search string) ([]domain.User, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	where := "WHERE 1=1"
	args := []interface{}{}
	idx := 1

	if search != "" {
		where += fmt.Sprintf(" AND (username ILIKE $%d OR email ILIKE $%d)", idx, idx)
		args = append(args, "%"+search+"%")
		idx++
	}

	var total int64
	s.db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM users %s", where), args...).Scan(&total)

	query := fmt.Sprintf(
		`SELECT id, username, email, role, avatar_url, storage_used, created_at
		 FROM users %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, idx, idx+1,
	)
	args = append(args, limit, offset)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []domain.User
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.Role, &u.AvatarURL, &u.StorageUsed, &u.CreatedAt); err != nil {
			return nil, 0, err
		}
		users = append(users, u)
	}
	return users, total, nil
}

func (s *AdminService) UpdateUserRole(ctx context.Context, userID int64, role string) error {
	_, err := s.db.Exec(ctx, `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`, role, userID)
	return err
}

func (s *AdminService) ListAllImages(ctx context.Context, page, limit int, search string, filterUserID int64) ([]domain.Image, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	where := "WHERE i.deleted_at IS NULL"
	args := []interface{}{}
	idx := 1

	if search != "" {
		where += fmt.Sprintf(" AND i.filename ILIKE $%d", idx)
		args = append(args, "%"+search+"%")
		idx++
	}
	if filterUserID > 0 {
		where += fmt.Sprintf(" AND i.user_id = $%d", idx)
		args = append(args, filterUserID)
		idx++
	}

	var total int64
	s.db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM images i %s", where), args...).Scan(&total)

	query := fmt.Sprintf(
		`SELECT i.id, i.user_id, i.filename, i.storage_key, i.mime_type, i.file_size,
		        i.thumbnail_key, i.view_count, i.created_at, u.username
		 FROM images i JOIN users u ON i.user_id = u.id
		 %s ORDER BY i.created_at DESC LIMIT $%d OFFSET $%d`,
		where, idx, idx+1,
	)
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
			&img.FileSize, &img.ThumbnailKey, &img.ViewCount, &img.CreatedAt, &img.Username); err != nil {
			return nil, 0, err
		}
		images = append(images, img)
	}
	return images, total, nil
}

func (s *AdminService) ForceDeleteImage(ctx context.Context, imageID int64) error {
	_, err := s.db.Exec(ctx, `UPDATE images SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`, imageID)
	return err
}

type TagStat struct {
	TagID      int64  `json:"tag_id"`
	TagName    string `json:"tag_name"`
	Color      string `json:"color"`
	ImageCount int64  `json:"image_count"`
}

type TagStatsResponse struct {
	TaggedImageCount int64     `json:"tagged_image_count"`
	TotalImages      int64     `json:"total_images"`
	TopTags          []TagStat `json:"top_tags"`
}

func (s *AdminService) GetTagStats(ctx context.Context) (*TagStatsResponse, error) {
	var resp TagStatsResponse

	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM images WHERE deleted_at IS NULL`).Scan(&resp.TotalImages)
	s.db.QueryRow(ctx,
		`SELECT COUNT(DISTINCT it.image_id) FROM image_tags it
		 JOIN images i ON i.id = it.image_id WHERE i.deleted_at IS NULL`,
	).Scan(&resp.TaggedImageCount)

	rows, err := s.db.Query(ctx,
		`SELECT t.id, t.name, t.color, COUNT(it.image_id) as cnt
		 FROM tags t
		 JOIN image_tags it ON t.id = it.tag_id
		 JOIN images i ON i.id = it.image_id AND i.deleted_at IS NULL
		 GROUP BY t.id, t.name, t.color
		 ORDER BY cnt DESC LIMIT 20`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var ts TagStat
		if err := rows.Scan(&ts.TagID, &ts.TagName, &ts.Color, &ts.ImageCount); err != nil {
			return nil, err
		}
		resp.TopTags = append(resp.TopTags, ts)
	}
	return &resp, nil
}
