BEGIN;

-- Keeps an administrator-reviewed message distinct from an optional note that
-- was entered while the invoice draft was first assembled.
ALTER TABLE student_invoices
    ADD COLUMN IF NOT EXISTS message_reviewed_at TIMESTAMPTZ;

COMMIT;
