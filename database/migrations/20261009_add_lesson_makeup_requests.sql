CREATE TABLE IF NOT EXISTS lesson_makeup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_credit_id UUID NOT NULL REFERENCES lesson_credits(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    preferred_session_id UUID NOT NULL REFERENCES classroom_sessions(id),
    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
        CHECK (status IN ('SUBMITTED', 'APPROVED', 'DECLINED', 'CANCELLED')),
    student_note VARCHAR(500),
    review_note VARCHAR(500),
    reviewed_by_admin_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lesson_makeup_requests_student
    ON lesson_makeup_requests(student_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_makeup_requests_status
    ON lesson_makeup_requests(status, submitted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_makeup_requests_open_credit
    ON lesson_makeup_requests(lesson_credit_id) WHERE status = 'SUBMITTED';
