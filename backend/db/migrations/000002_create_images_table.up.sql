CREATE TABLE images (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        VARCHAR(255) NOT NULL,
    storage_key     VARCHAR(512) NOT NULL,
    mime_type       VARCHAR(64)  NOT NULL,
    file_size       BIGINT       NOT NULL,
    width           INT,
    height          INT,
    thumbnail_key   VARCHAR(512),
    alt_text        VARCHAR(512),
    view_count      BIGINT       NOT NULL DEFAULT 0,
    is_public       BOOLEAN      NOT NULL DEFAULT TRUE,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_images_created_at ON images(created_at DESC);
CREATE INDEX idx_images_deleted_at ON images(deleted_at) WHERE deleted_at IS NULL;
