-- Lesson rights are financial entitlements, not a side effect of issuing an invoice. Existing
-- packages are classified from their invoice, and unpaid credits are detached so they cannot be
-- consumed while payment is outstanding.
ALTER TABLE student_session_packages
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'PENDING_PAYMENT';

ALTER TABLE student_session_packages DROP CONSTRAINT IF EXISTS student_session_packages_status_check;
ALTER TABLE student_session_packages
    ADD CONSTRAINT student_session_packages_status_check
    CHECK (status IN ('PENDING_PAYMENT', 'ACTIVE', 'CANCELLED'));

UPDATE student_session_packages package
SET status = CASE
    WHEN invoice.status = 'PAID' THEN 'ACTIVE'
    WHEN invoice.status = 'CANCELLED' THEN 'CANCELLED'
    ELSE 'PENDING_PAYMENT'
END
FROM student_invoices invoice
WHERE invoice.id = package.invoice_id;

ALTER TABLE lesson_credits DROP CONSTRAINT IF EXISTS lesson_credits_status_check;
ALTER TABLE lesson_credits
    ADD CONSTRAINT lesson_credits_status_check CHECK (status IN (
        'PENDING_PAYMENT', 'AVAILABLE', 'BOOKED', 'USED', 'COUNTED_ABSENCE', 'MAKEUP_DUE',
        'MAKEUP_SCHEDULED', 'EXPIRED', 'VOID'
    ));

UPDATE lesson_credits credit
SET status = 'PENDING_PAYMENT',
    original_session_id = NULL,
    current_session_id = NULL,
    source_attendance_record_id = NULL,
    updated_at = NOW()
FROM student_session_packages package
WHERE package.id = credit.session_package_id
  AND package.status = 'PENDING_PAYMENT'
  AND credit.status <> 'VOID';

ALTER TABLE lesson_credit_events DROP CONSTRAINT IF EXISTS lesson_credit_events_event_type_check;
ALTER TABLE lesson_credit_events
    ADD CONSTRAINT lesson_credit_events_event_type_check CHECK (event_type IN (
        'CREATED', 'PAYMENT_ACTIVATED', 'LESSON_BOOKED', 'ATTENDANCE_RECORDED', 'ABSENCE_COUNTED',
        'MAKEUP_APPROVED', 'MAKEUP_SCHEDULED', 'MAKEUP_COMPLETED', 'SESSION_CANCELLED',
        'MANUAL_ADJUSTMENT'
    ));
