ALTER TABLE student_support_requests
    ADD COLUMN IF NOT EXISTS leave_lesson_treatment VARCHAR(32);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'student_support_requests_leave_lesson_treatment_check'
    ) THEN
        ALTER TABLE student_support_requests
            ADD CONSTRAINT student_support_requests_leave_lesson_treatment_check
            CHECK (
                leave_lesson_treatment IS NULL
                OR leave_lesson_treatment IN ('KEEP_CHARGED', 'ALLOW_MAKEUP')
            );
    END IF;
END $$;
