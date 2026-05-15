package service

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nbplus/image_upload_platform/internal/domain"
)

type TagService struct {
	db *pgxpool.Pool
}

func NewTagService(db *pgxpool.Pool) *TagService {
	return &TagService{db: db}
}

func (s *TagService) List(ctx context.Context, search string) ([]domain.Tag, error) {
	query := `SELECT t.id, t.name, t.color, t.created_at, COUNT(it.image_id) as count
		FROM tags t LEFT JOIN image_tags it ON t.id = it.tag_id`
	var args []interface{}

	if search != "" {
		query += " WHERE t.name ILIKE $1"
		args = append(args, "%"+search+"%")
	}
	query += " GROUP BY t.id ORDER BY count DESC, t.name ASC"

	r, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	var tags []domain.Tag
	for r.Next() {
		var t domain.Tag
		if err := r.Scan(&t.ID, &t.Name, &t.Color, &t.CreatedAt, &t.Count); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	return tags, nil
}

func (s *TagService) Create(ctx context.Context, name string, color string) (*domain.Tag, error) {
	if color == "" {
		color = "#1890ff"
	}
	name = strings.TrimSpace(name)
	var tag domain.Tag
	err := s.db.QueryRow(ctx,
		`INSERT INTO tags (name, color) VALUES ($1, $2)
		 ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color
		 RETURNING id, name, color, created_at`,
		name, color,
	).Scan(&tag.ID, &tag.Name, &tag.Color, &tag.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &tag, nil
}

func (s *TagService) Delete(ctx context.Context, tagID int64) error {
	_, err := s.db.Exec(ctx, `DELETE FROM tags WHERE id = $1`, tagID)
	return err
}
