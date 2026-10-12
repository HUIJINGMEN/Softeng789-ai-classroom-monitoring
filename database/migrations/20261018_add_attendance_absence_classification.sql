ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS absence_reason VARCHAR(32),
    ADD COLUMN IF NOT EXISTS absence_note VARCHAR(500);

ALTER TABLE attendance_records
    DROP CONSTRAINT IF EXISTS attendance_records_absence_reason_check;

ALTER TABLE attendance_records
    ADD CONSTRAINT attendance_records_absence_reason_check
    CHECK (absence_reason IS NULL OR absence_reason IN (
        'ILLNESS', 'ADVANCE_NOTICE', 'NO_NOTICE', 'SCHOOL_CANCELLED', 'OTHER'
    ));

UPDATE attendance_records
SET absence_reason = NULL,
    absence_note = NULL
WHERE status <> 'ABSENT';
