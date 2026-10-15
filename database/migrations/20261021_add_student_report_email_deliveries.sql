-- Durable no-resend barrier: SMTP cannot guarantee exactly-once delivery after an ambiguous timeout.
CREATE TABLE IF NOT EXISTS student_report_email_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES student_reports(id) ON DELETE CASCADE,
    report_version BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
    message VARCHAR(1000) NOT NULL DEFAULT 'Email delivery is not yet confirmed.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_student_report_email_revision UNIQUE (report_id, report_version)
);
