CREATE TABLE IF NOT EXISTS student_fee_requests (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    request_details TEXT NOT NULL,
    evidence_file_name VARCHAR(255), evidence_content_type VARCHAR(100), evidence_file_size BIGINT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUBMITTED', 'INVOICED', 'DECLINED')),
    reviewed_by_admin_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES student_invoices(id) ON DELETE SET NULL,
    review_note TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_student_fee_requests_student ON student_fee_requests(student_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_fee_requests_status ON student_fee_requests(status, submitted_at DESC);
