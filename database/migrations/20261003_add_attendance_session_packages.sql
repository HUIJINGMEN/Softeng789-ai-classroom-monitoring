-- Connect prepaid lesson packages to attendance without mixing financial and teaching records.
ALTER TABLE student_invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(32);
-- Earlier development fixtures intentionally share the same UUID prefix, so a prefix-based
-- backfill can collide. Repair both missing and already-colliding generated numbers using the
-- UUID tail before the unique index is created.
WITH duplicate_numbers AS (
    SELECT invoice_number
    FROM student_invoices
    WHERE invoice_number IS NOT NULL
    GROUP BY invoice_number
    HAVING COUNT(*) > 1
)
UPDATE student_invoices
SET invoice_number = 'CL-' || EXTRACT(YEAR FROM created_at)::INTEGER || '-'
        || UPPER(RIGHT(REPLACE(id::TEXT, '-', ''), 24))
WHERE invoice_number IS NULL
   OR invoice_number IN (SELECT invoice_number FROM duplicate_numbers);
ALTER TABLE student_invoices ALTER COLUMN invoice_number SET NOT NULL;
ALTER TABLE student_invoices ADD COLUMN IF NOT EXISTS last_emailed_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_invoices_number ON student_invoices(invoice_number);

CREATE TABLE IF NOT EXISTS student_session_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_offering_id UUID NOT NULL REFERENCES course_offerings(id),
    invoice_id UUID NOT NULL UNIQUE REFERENCES student_invoices(id) ON DELETE CASCADE,
    purchased_sessions INTEGER NOT NULL CHECK (purchased_sessions > 0),
    service_from DATE NOT NULL,
    service_to DATE NOT NULL CHECK (service_to >= service_from),
    absence_policy VARCHAR(32) NOT NULL
        CHECK (absence_policy IN ('CONSUME_UNEXCUSED', 'ATTENDANCE_ONLY')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Every exception remains traceable instead of silently rewriting attendance history.
CREATE TABLE IF NOT EXISTS attendance_billing_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_record_id UUID NOT NULL UNIQUE REFERENCES attendance_records(id) ON DELETE CASCADE,
    decision VARCHAR(16) NOT NULL CHECK (decision IN ('CONSUME', 'WAIVE')),
    reason VARCHAR(500) NOT NULL,
    updated_by_admin_id UUID NOT NULL REFERENCES teachers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_packages_student_offering
    ON student_session_packages(student_id, course_offering_id, service_from, service_to);
CREATE INDEX IF NOT EXISTS idx_attendance_billing_overrides_admin
    ON attendance_billing_overrides(updated_by_admin_id, updated_at DESC);
