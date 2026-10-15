-- Staff-only frozen class reports; no student-portal publication or bulk email route.
BEGIN;
CREATE TABLE IF NOT EXISTS class_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    created_by_id UUID NOT NULL REFERENCES teachers(id),
    scope_key VARCHAR(64) NOT NULL,
    document TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalized_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_class_reports_scope ON class_reports(course_offering_id, created_by_id, scope_key);
CREATE INDEX IF NOT EXISTS idx_class_reports_finalized ON class_reports(course_offering_id, finalized_at);
COMMIT;
