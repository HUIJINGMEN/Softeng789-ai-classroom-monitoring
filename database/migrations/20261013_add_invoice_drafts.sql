BEGIN;

-- An invoice is private to administrators until its message has been reviewed
-- and delivery has been explicitly approved.
ALTER TABLE student_invoices
    DROP CONSTRAINT IF EXISTS student_invoices_status_check;

ALTER TABLE student_invoices
    ALTER COLUMN status SET DEFAULT 'DRAFT';

ALTER TABLE student_invoices
    ADD CONSTRAINT student_invoices_status_check
    CHECK (status IN ('DRAFT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'));

COMMIT;
