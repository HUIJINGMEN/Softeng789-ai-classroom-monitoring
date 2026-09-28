BEGIN;

CREATE TABLE IF NOT EXISTS student_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    created_by_admin_id UUID NOT NULL REFERENCES teachers(id),
    title VARCHAR(160) NOT NULL,
    note TEXT,
    due_date DATE NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'NZD',
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES student_invoices(id) ON DELETE CASCADE,
    description VARCHAR(180) NOT NULL,
    type VARCHAR(16) NOT NULL CHECK (type IN ('CHARGE', 'CREDIT')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES student_invoices(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(16) NOT NULL CHECK (status IN ('SUCCEEDED', 'FAILED', 'REFUNDED')),
    provider VARCHAR(40) NOT NULL,
    provider_reference VARCHAR(120) NOT NULL UNIQUE,
    occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_invoices_student_due
    ON student_invoices(student_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_invoices_status_due
    ON student_invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice
    ON invoice_line_items(invoice_id, position);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice
    ON payment_transactions(invoice_id, occurred_at DESC);

COMMIT;
