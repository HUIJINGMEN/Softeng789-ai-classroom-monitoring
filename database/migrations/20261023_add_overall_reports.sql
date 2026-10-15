-- Administrator-only internal/partner reports, no financial or student-detail payloads.
BEGIN;
CREATE TABLE IF NOT EXISTS overall_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_id UUID NOT NULL REFERENCES teachers(id),
    scope_key VARCHAR(64) NOT NULL,
    document TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalized_at TIMESTAMPTZ,
    privacy_reviewed_by VARCHAR(255),
    privacy_reviewed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_overall_reports_scope ON overall_reports(created_by_id, scope_key);
CREATE INDEX IF NOT EXISTS idx_overall_reports_finalized ON overall_reports(finalized_at);
COMMIT;
