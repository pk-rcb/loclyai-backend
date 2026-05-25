-- Password Reset Tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID             NOT NULL,
    user_type       VARCHAR(20)      NOT NULL CHECK (user_type IN ('citizen', 'authority')),
    token_hash      VARCHAR(255)     NOT NULL,
    expires_at      TIMESTAMPTZ      NOT NULL,
    created_at      TIMESTAMPTZ      DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id, user_type);
