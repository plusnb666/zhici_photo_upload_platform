package service

import (
	"context"
	"fmt"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nbplus/image_upload_platform/internal/domain"
)

type CommentService struct {
	db *pgxpool.Pool
}

func NewCommentService(db *pgxpool.Pool) *CommentService {
	return &CommentService{db: db}
}

func (s *CommentService) List(ctx context.Context, imageID int64) ([]domain.Comment, error) {
	rows, err := s.db.Query(ctx,
		`SELECT c.id, c.image_id, c.user_id, c.content, c.created_at, u.username
		 FROM comments c JOIN users u ON c.user_id = u.id
		 WHERE c.image_id = $1 ORDER BY c.created_at ASC`, imageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []domain.Comment
	for rows.Next() {
		var c domain.Comment
		if err := rows.Scan(&c.ID, &c.ImageID, &c.UserID, &c.Content, &c.CreatedAt, &c.Username); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, nil
}

func (s *CommentService) Create(ctx context.Context, imageID, userID int64, content string) (*domain.Comment, error) {
	if runeCount := utf8.RuneCountInString(content); runeCount == 0 || runeCount > 1000 {
		return nil, fmt.Errorf("评论内容 1-1000 字")
	}
	var c domain.Comment
	err := s.db.QueryRow(ctx,
		`INSERT INTO comments (image_id, user_id, content) VALUES ($1, $2, $3)
		 RETURNING id, image_id, user_id, content, created_at`,
		imageID, userID, content,
	).Scan(&c.ID, &c.ImageID, &c.UserID, &c.Content, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	// fetch username
	s.db.QueryRow(ctx, `SELECT username FROM users WHERE id = $1`, userID).Scan(&c.Username)
	return &c, nil
}

func (s *CommentService) Delete(ctx context.Context, commentID, userID int64, isAdmin bool) error {
	var ownerID int64
	err := s.db.QueryRow(ctx, `SELECT user_id FROM comments WHERE id = $1`, commentID).Scan(&ownerID)
	if err != nil {
		return fmt.Errorf("comment not found")
	}
	if ownerID != userID && !isAdmin {
		return fmt.Errorf("permission denied")
	}
	_, err = s.db.Exec(ctx, `DELETE FROM comments WHERE id = $1`, commentID)
	return err
}
