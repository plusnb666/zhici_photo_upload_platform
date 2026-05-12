package service

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/nbplus/image_upload_platform/internal/domain"
	jwtpkg "github.com/nbplus/image_upload_platform/pkg/jwt"
)

var (
	ErrUserExists       = errors.New("user already exists")
	ErrInvalidCreds     = errors.New("invalid credentials")
	ErrTokenRevoked     = errors.New("token revoked")
)

type AuthService struct {
	db        *pgxpool.Pool
	jwtSecret string
}

func NewAuthService(db *pgxpool.Pool, jwtSecret string) *AuthService {
	return &AuthService{db: db, jwtSecret: jwtSecret}
}

func (s *AuthService) Register(ctx context.Context, username, email, password string) (*domain.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}

	var user domain.User
	err = s.db.QueryRow(ctx,
		`INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)
		 RETURNING id, username, email, role, avatar_url, storage_used, created_at`,
		username, email, string(hash),
	).Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.AvatarURL, &user.StorageUsed, &user.CreatedAt)

	if err != nil {
		if isDuplicateKeyError(err) {
			return nil, ErrUserExists
		}
		return nil, err
	}
	return &user, nil
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*domain.User, string, string, error) {
	var user domain.User
	err := s.db.QueryRow(ctx,
		`SELECT id, username, email, password_hash, role, avatar_url, storage_used, created_at
		 FROM users WHERE email = $1`, email,
	).Scan(&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.Role, &user.AvatarURL, &user.StorageUsed, &user.CreatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", "", ErrInvalidCreds
	}
	if err != nil {
		return nil, "", "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", "", ErrInvalidCreds
	}

	accessToken, err := jwtpkg.GenerateAccessToken(s.jwtSecret, user.ID, user.Role)
	if err != nil {
		return nil, "", "", err
	}

	refreshToken, err := jwtpkg.GenerateRefreshTokenBytes()
	if err != nil {
		return nil, "", "", err
	}
	tokenHash := jwtpkg.HashToken(refreshToken)

	_, err = s.db.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		user.ID, tokenHash, time.Now().Add(7*24*time.Hour),
	)
	if err != nil {
		return nil, "", "", err
	}

	return &user, accessToken, refreshToken, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (string, string, error) {
	tokenHash := jwtpkg.HashToken(refreshToken)

	var token domain.RefreshToken
	err := s.db.QueryRow(ctx,
		`SELECT id, user_id, expires_at, revoked FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash,
	).Scan(&token.ID, &token.UserID, &token.ExpiresAt, &token.Revoked)

	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrInvalidCreds
	}
	if err != nil {
		return "", "", err
	}
	if token.Revoked || time.Now().After(token.ExpiresAt) {
		return "", "", ErrTokenRevoked
	}

	// Revoke old token
	_, _ = s.db.Exec(ctx, `UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`, token.ID)

	var role string
	err = s.db.QueryRow(ctx, `SELECT role FROM users WHERE id = $1`, token.UserID).Scan(&role)
	if err != nil {
		return "", "", err
	}

	accessToken, err := jwtpkg.GenerateAccessToken(s.jwtSecret, token.UserID, role)
	if err != nil {
		return "", "", err
	}

	newRefreshToken, err := jwtpkg.GenerateRefreshTokenBytes()
	if err != nil {
		return "", "", err
	}
	newHash := jwtpkg.HashToken(newRefreshToken)
	_, err = s.db.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		token.UserID, newHash, time.Now().Add(7*24*time.Hour),
	)
	if err != nil {
		return "", "", err
	}

	return accessToken, newRefreshToken, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	tokenHash := jwtpkg.HashToken(refreshToken)
	_, err := s.db.Exec(ctx, `UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, tokenHash)
	return err
}

func (s *AuthService) GetUser(ctx context.Context, userID int64) (*domain.User, error) {
	var user domain.User
	err := s.db.QueryRow(ctx,
		`SELECT id, username, email, role, avatar_url, storage_used, created_at
		 FROM users WHERE id = $1`, userID,
	).Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.AvatarURL, &user.StorageUsed, &user.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func isDuplicateKeyError(err error) bool {
	var pgErr interface{ SQLState() string }
	if errors.As(err, &pgErr) {
		return pgErr.SQLState() == "23505"
	}
	return false
}
