-- Additive security state only; does not modify accounts, passwords or business data.
BEGIN;
CREATE TABLE IF NOT EXISTS login_attempt_windows (
    identity_digest VARCHAR(64) PRIMARY KEY,
    window_id UUID NOT NULL,
    attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
    first_attempt_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempt_windows_expiry ON login_attempt_windows(expires_at);
COMMIT;
