-- Apply after 20261024_add_photo_attendance.sql, before starting the 2A backend (even with CV disabled).
BEGIN;
CREATE TABLE IF NOT EXISTS cv_student_checkins (
    id uuid PRIMARY KEY,
    version bigint NOT NULL DEFAULT 0,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id uuid NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
    request_key uuid NOT NULL,
    request_digest varchar(255) NOT NULL,
    state varchar(255) NOT NULL CHECK (state IN ('PENDING','PRESENT','LATE','REJECTED','EXPIRED')),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES teachers(id),
    encrypted_result text,
    UNIQUE(student_id, request_key)
);
CREATE INDEX IF NOT EXISTS idx_cv_checkins_student_session ON cv_student_checkins(student_id, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_checkins_session ON cv_student_checkins(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_checkins_expiry ON cv_student_checkins(expires_at);
COMMIT;
