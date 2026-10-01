BEGIN;

CREATE TABLE IF NOT EXISTS payment_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name VARCHAR(120) NOT NULL,
    bank_name VARCHAR(120) NOT NULL,
    account_number VARCHAR(80) NOT NULL,
    payment_reference VARCHAR(120),
    instructions TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by_admin_id UUID NOT NULL REFERENCES teachers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bank_transfer_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES student_invoices(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    student_note TEXT,
    original_file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by_admin_id UUID REFERENCES teachers(id),
    review_note TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_bank_account_active
    ON payment_bank_accounts(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_bank_transfer_review_queue
    ON bank_transfer_submissions(status, submitted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transfer_pending_invoice
    ON bank_transfer_submissions(invoice_id) WHERE status = 'PENDING';

COMMIT;
