-- Cash may be reported without an attachment; it still requires administrator verification.
-- No existing submissions, receipts or payments are changed.
BEGIN;

ALTER TABLE manual_payment_submissions
    ALTER COLUMN original_file_name DROP NOT NULL,
    ALTER COLUMN content_type DROP NOT NULL;

-- The original table was renamed in 20261002; existing installations may retain its old name.
ALTER TABLE manual_payment_submissions
    DROP CONSTRAINT IF EXISTS bank_transfer_submissions_file_size_check,
    DROP CONSTRAINT IF EXISTS manual_payment_submissions_file_size_check,
    DROP CONSTRAINT IF EXISTS chk_manual_payment_receipt_presence;

ALTER TABLE manual_payment_submissions
    ADD CONSTRAINT chk_manual_payment_receipt_presence CHECK (
        (method = 'CASH' AND original_file_name IS NULL AND content_type IS NULL AND file_size = 0)
        OR (original_file_name IS NOT NULL AND content_type IS NOT NULL AND file_size > 0)
    );

COMMIT;
