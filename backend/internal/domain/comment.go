package domain

import "time"

type Comment struct {
	ID        int64     `json:"id"`
	ImageID   int64     `json:"image_id"`
	UserID    int64     `json:"user_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	Username  string    `json:"username"` // JOIN users
}
