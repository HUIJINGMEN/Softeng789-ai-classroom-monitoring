-- A top candidate is only a suggestion, not the owner of another student's history.
ALTER TABLE kiosk_attempts DROP CONSTRAINT kiosk_attempts_top_student_id_fkey;
ALTER TABLE kiosk_attempts ADD CONSTRAINT kiosk_attempts_top_student_id_fkey
    FOREIGN KEY (top_student_id) REFERENCES students(id) ON DELETE SET NULL;

-- Support retained-history checks before deleting a campus.
CREATE INDEX kiosk_sessions_campus_idx ON kiosk_sessions(campus_id);
CREATE INDEX kiosk_attempts_campus_idx ON kiosk_attempts(campus_id);
