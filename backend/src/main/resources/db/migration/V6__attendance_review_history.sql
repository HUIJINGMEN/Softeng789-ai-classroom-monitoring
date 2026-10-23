CREATE TABLE attendance_review_events (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
    action varchar(40) NOT NULL,
    previous_status varchar(20),
    resulting_status varchar(20) NOT NULL,
    occurred_at timestamptz NOT NULL
);
CREATE INDEX idx_attendance_review_session_time ON attendance_review_events(session_id, occurred_at DESC, id DESC);
CREATE INDEX idx_attendance_review_student ON attendance_review_events(student_id);
CREATE INDEX idx_attendance_review_actor ON attendance_review_events(actor_id);
