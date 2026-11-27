-- Separate, explicitly launched kiosk policy. Recognition only proposes candidates.
ALTER TABLE login_sessions DROP CONSTRAINT login_sessions_role_check;
ALTER TABLE login_sessions ADD CONSTRAINT login_sessions_role_check CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT', 'KIOSK'));
ALTER TABLE attendance_records DROP CONSTRAINT attendance_records_source_check;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_source_check CHECK (source IN ('MANUAL', 'AI', 'KIOSK'));

CREATE TABLE kiosk_sessions (
    id uuid PRIMARY KEY,
    version bigint NOT NULL DEFAULT 0,
    session_id uuid NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
    campus_id uuid NOT NULL REFERENCES campuses(id),
    location_label varchar(80) NOT NULL,
    launched_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
    launched_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    late_after_minutes integer CHECK (late_after_minutes BETWEEN 0 AND 60),
    last_capture_at timestamptz,
    ended_at timestamptz,
    ended_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
    end_reason varchar(255) CHECK (end_reason IN ('DEVICE_EXIT', 'STAFF_ENDED', 'EXPIRED', 'ACCESS_LOST'))
);
CREATE INDEX kiosk_sessions_class_idx ON kiosk_sessions(session_id);
CREATE INDEX kiosk_sessions_expiry_idx ON kiosk_sessions(expires_at) WHERE ended_at IS NULL;

CREATE TABLE kiosk_attempts (
    id uuid PRIMARY KEY,
    version bigint NOT NULL DEFAULT 0,
    kiosk_session_id uuid NOT NULL REFERENCES kiosk_sessions(id) ON DELETE CASCADE,
    session_id uuid NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
    campus_id uuid NOT NULL REFERENCES campuses(id),
    location_label varchar(80) NOT NULL,
    request_key uuid NOT NULL,
    request_digest varchar(64) NOT NULL,
    state varchar(255) NOT NULL CHECK (state IN ('NO_FACE', 'MULTIPLE_FACES', 'LOW_QUALITY', 'NO_CANDIDATE',
        'AWAITING_SELECTION', 'CONFIRMED', 'ALREADY_RECORDED', 'BLOCKED_NOT_ENROLLED', 'ATTENDANCE_LOCKED',
        'STALE', 'SESSION_CLOSED', 'CANCELLED_NOT_LISTED', 'CANCELLED_TIMEOUT', 'SUPERSEDED', 'EXPIRED')),
    recognition_decision varchar(20),
    candidate_count smallint NOT NULL CHECK (candidate_count BETWEEN 0 AND 3),
    top_student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    selected_student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    selected_rank smallint CHECK (selected_rank BETWEEN 1 AND 3),
    attendance_status varchar(255) CHECK (attendance_status IN ('PRESENT', 'LATE')),
    selected_display_name varchar(255),
    quality_reasons text,
    captured_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    processed_at timestamptz,
    encrypted_candidates text,
    encrypted_capture text,
    UNIQUE(kiosk_session_id, request_key)
);
CREATE INDEX kiosk_attempts_session_idx ON kiosk_attempts(session_id, captured_at DESC);
CREATE INDEX kiosk_attempts_device_idx ON kiosk_attempts(kiosk_session_id, captured_at DESC);
CREATE INDEX kiosk_attempts_expiry_idx ON kiosk_attempts(state, expires_at);

CREATE TABLE kiosk_evidence (
    attempt_id uuid PRIMARY KEY REFERENCES kiosk_attempts(id) ON DELETE CASCADE,
    content_type varchar(255) NOT NULL,
    encrypted_image text NOT NULL,
    captured_at timestamptz NOT NULL,
    delete_after timestamptz NOT NULL
);
CREATE INDEX kiosk_evidence_expiry_idx ON kiosk_evidence(delete_after);

CREATE TABLE kiosk_review_items (
    id uuid PRIMARY KEY,
    attempt_id uuid NOT NULL UNIQUE REFERENCES kiosk_attempts(id) ON DELETE CASCADE,
    kind varchar(255) NOT NULL CHECK (kind IN ('CANDIDATE_SELECTION_MISMATCH', 'NOT_ENROLLED_ATTEMPT')),
    state varchar(255) NOT NULL CHECK (state IN ('OPEN', 'RESOLVED')),
    created_at timestamptz NOT NULL,
    resolution varchar(255) CHECK (resolution IN ('VERIFIED_CORRECT', 'ATTENDANCE_CORRECTED', 'NO_ACTION')),
    note varchar(500),
    resolved_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
    resolved_at timestamptz
);
CREATE INDEX kiosk_review_items_queue_idx ON kiosk_review_items(state, created_at DESC);
