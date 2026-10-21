-- Historical receipt dates remain unknown; do not replace them with submission/review dates.
SET search_path TO public;
ALTER TABLE manual_payment_submissions ADD COLUMN received_date DATE;

CREATE TABLE feedback_email_deliveries (
    id VARCHAR(64) PRIMARY KEY,
    summary_id UUID NOT NULL REFERENCES feedback_summaries(id) ON DELETE CASCADE,
    message_snapshot TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    message VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_feedback_email_summary ON feedback_email_deliveries(summary_id);

-- Fail safely if a legacy database has duplicates; never discard somebody's draft.
CREATE UNIQUE INDEX uq_student_report_open_scope ON student_reports(student_id, created_by_id, scope_key)
    WHERE published_at IS NULL;
CREATE UNIQUE INDEX uq_class_report_open_scope ON class_reports(course_offering_id, created_by_id, scope_key)
    WHERE finalized_at IS NULL;
CREATE UNIQUE INDEX uq_overall_report_open_scope ON overall_reports(created_by_id, scope_key)
    WHERE finalized_at IS NULL;
