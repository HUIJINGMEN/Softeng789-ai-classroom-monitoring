-- Additive only. Existing passwords, accounts, sessions and business records are unchanged.
BEGIN;
CREATE TABLE IF NOT EXISTS account_links (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    purpose VARCHAR(32) NOT NULL CHECK (purpose IN ('STUDENT_REGISTRATION', 'STAFF_ACTIVATION', 'PASSWORD_RESET')),
    state VARCHAR(20) NOT NULL CHECK (state IN ('REQUESTED', 'DISPATCHED', 'USED', 'DISCARDED')),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    credential_digest VARCHAR(64) UNIQUE,
    account_id UUID,
    account_role VARCHAR(20),
    password_fingerprint VARCHAR(64),
    version BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_links_pending ON account_links(state, created_at, id);
CREATE INDEX IF NOT EXISTS idx_account_links_expiry ON account_links(expires_at);
COMMIT;
