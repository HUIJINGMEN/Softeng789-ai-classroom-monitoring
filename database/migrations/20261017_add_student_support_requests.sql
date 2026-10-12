-- Unified student/parent contact channel. This records questions and requests for staff review;
-- it deliberately does not create invoices or mutate payment records.
CREATE TABLE IF NOT EXISTS student_support_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    requester_role VARCHAR(24) NOT NULL CHECK (requester_role IN ('STUDENT', 'PARENT_GUARDIAN')),
    contact_name VARCHAR(160) NOT NULL,
    relationship_to_student VARCHAR(80),
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(40),
    request_type VARCHAR(32) NOT NULL CHECK (request_type IN (
        'LEAVE', 'SCHEDULE_CHANGE', 'PAYMENT_QUESTION', 'MAKEUP', 'GENERAL'
    )),
    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
        'SUBMITTED', 'APPROVED', 'DECLINED', 'RESOLVED', 'CANCELLED'
    )),
    course_offering_id UUID REFERENCES course_offerings(id) ON DELETE SET NULL,
    session_id UUID REFERENCES classroom_sessions(id) ON DELETE SET NULL,
    leave_reason VARCHAR(32) CHECK (leave_reason IN (
        'ILLNESS', 'FAMILY', 'SCHOOL_COMMITMENT', 'EMERGENCY', 'OTHER'
    )),
    subject VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    review_note TEXT,
    reviewed_by_admin_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    CONSTRAINT student_support_requests_leave_context CHECK (
        request_type <> 'LEAVE' OR (session_id IS NOT NULL AND leave_reason IS NOT NULL)
    ),
    CONSTRAINT student_support_requests_parent_contact CHECK (
        requester_role <> 'PARENT_GUARDIAN'
        OR (relationship_to_student IS NOT NULL AND LENGTH(TRIM(relationship_to_student)) > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_student_support_requests_student
    ON student_support_requests(student_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_support_requests_status
    ON student_support_requests(status, submitted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_support_requests_open_leave
    ON student_support_requests(student_id, session_id)
    WHERE request_type = 'LEAVE' AND status IN ('SUBMITTED', 'APPROVED');
