-- Model purchased lessons explicitly so an original absence can be linked to a later make-up.
CREATE TABLE IF NOT EXISTS lesson_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_package_id UUID NOT NULL REFERENCES student_session_packages(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
    original_session_id UUID REFERENCES classroom_sessions(id),
    current_session_id UUID REFERENCES classroom_sessions(id),
    source_attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN (
        'AVAILABLE', 'BOOKED', 'USED', 'COUNTED_ABSENCE', 'MAKEUP_DUE',
        'MAKEUP_SCHEDULED', 'EXPIRED', 'VOID'
    )),
    absence_reason VARCHAR(32) CHECK (absence_reason IN (
        'ILLNESS', 'ADVANCE_NOTICE', 'NO_NOTICE', 'SCHOOL_CANCELLED', 'OTHER'
    )),
    decision_note VARCHAR(500),
    decided_by_admin_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    expires_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT lesson_credits_package_sequence_unique UNIQUE (session_package_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS lesson_credit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_credit_id UUID NOT NULL REFERENCES lesson_credits(id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL CHECK (event_type IN (
        'CREATED', 'ATTENDANCE_RECORDED', 'ABSENCE_COUNTED', 'MAKEUP_APPROVED',
        'MAKEUP_SCHEDULED', 'MAKEUP_RESCHEDULED', 'MAKEUP_CANCELLED', 'MAKEUP_COMPLETED',
        'SESSION_CANCELLED', 'MANUAL_ADJUSTMENT'
    )),
    from_status VARCHAR(32),
    to_status VARCHAR(32) NOT NULL,
    source_session_id UUID REFERENCES classroom_sessions(id),
    target_session_id UUID REFERENCES classroom_sessions(id),
    note VARCHAR(500),
    actor_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_credits_package_status
    ON lesson_credits(session_package_id, status);
CREATE INDEX IF NOT EXISTS idx_lesson_credits_current_session
    ON lesson_credits(current_session_id, status);
CREATE INDEX IF NOT EXISTS idx_lesson_credit_events_credit
    ON lesson_credit_events(lesson_credit_id, created_at);
