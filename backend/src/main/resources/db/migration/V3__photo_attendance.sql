-- Optional photo attendance; additive for existing phase-1 databases.
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS cv_face_profiles (
    student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    version bigint NOT NULL DEFAULT 0,
    revision uuid NOT NULL,
    consent_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    notice_version varchar(255) NOT NULL,
    encrypted_templates text,
    model_version varchar(255),
    enrolled_by uuid REFERENCES teachers(id),
    enrolled_at timestamptz
);
CREATE TABLE IF NOT EXISTS cv_photo_reviews (
    id uuid PRIMARY KEY,
    version bigint NOT NULL DEFAULT 0,
    session_id uuid NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
    requested_by uuid NOT NULL REFERENCES teachers(id),
    request_key uuid NOT NULL,
    request_digest varchar(255) NOT NULL,
    state varchar(255) NOT NULL CHECK (state IN ('PENDING','REVIEWED','EXPIRED')),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES teachers(id),
    encrypted_result text,
    encrypted_decision text,
    UNIQUE(requested_by, request_key)
);
CREATE INDEX IF NOT EXISTS idx_cv_reviews_expiry ON cv_photo_reviews(expires_at);
CREATE TABLE IF NOT EXISTS cv_photo_review_subjects (
    review_id uuid NOT NULL REFERENCES cv_photo_reviews(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    PRIMARY KEY (review_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_cv_review_subject ON cv_photo_review_subjects(student_id);
