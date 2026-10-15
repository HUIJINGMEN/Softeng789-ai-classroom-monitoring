BEGIN;
CREATE TABLE IF NOT EXISTS student_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    created_by_id UUID NOT NULL REFERENCES teachers(id),
    scope_key VARCHAR(64) NOT NULL,
    document TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_student_reports_scope ON student_reports(student_id, created_by_id, scope_key);
CREATE INDEX IF NOT EXISTS idx_student_reports_published ON student_reports(student_id, published_at);
COMMIT;
