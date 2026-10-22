-- Additive only: no account, password, business record or historical report is changed.
-- Existing in-memory Bearer sessions are deliberately not migrated.
BEGIN;
CREATE TABLE IF NOT EXISTS login_sessions (
    credential_digest VARCHAR(64) PRIMARY KEY,
    account_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT')),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT login_session_expiry CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_login_sessions_account ON login_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_expiry ON login_sessions(expires_at);
COMMIT;
