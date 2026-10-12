BEGIN;

ALTER TABLE bank_transfer_submissions RENAME TO manual_payment_submissions;
ALTER TABLE manual_payment_submissions
    ADD COLUMN method VARCHAR(24) NOT NULL DEFAULT 'BANK_TRANSFER';
ALTER TABLE manual_payment_submissions ALTER COLUMN method DROP DEFAULT;
ALTER TABLE manual_payment_submissions
    ADD CONSTRAINT chk_manual_payment_method CHECK (method IN ('BANK_TRANSFER', 'CASH'));

ALTER INDEX idx_bank_transfer_review_queue RENAME TO idx_manual_payment_review_queue;
ALTER INDEX idx_bank_transfer_pending_invoice RENAME TO idx_manual_payment_pending_invoice;

COMMIT;
