-- Apply after 20261025_add_student_checkins.sql before starting the updated backend, even with CV disabled.
BEGIN;
CREATE TABLE IF NOT EXISTS cv_registration_faces (
    student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    version bigint NOT NULL DEFAULT 0,
    attendance_mode varchar(255) NOT NULL CHECK (attendance_mode IN ('MANUAL','FACE')),
    state varchar(255) NOT NULL CHECK (state IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
    submitted_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    notice_version varchar(255),
    encrypted_payload text,
    reviewed_by uuid REFERENCES teachers(id),
    reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cv_registration_expiry ON cv_registration_faces(state, expires_at);
COMMIT;
