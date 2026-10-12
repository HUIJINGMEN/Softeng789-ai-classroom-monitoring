-- Phase 3: package lifecycle and immutable account audit trail.
ALTER TABLE student_session_packages
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lifecycle_note VARCHAR(500);

ALTER TABLE student_session_packages DROP CONSTRAINT IF EXISTS student_session_packages_status_check;
ALTER TABLE student_session_packages
    ADD CONSTRAINT student_session_packages_status_check
    CHECK (status IN ('PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'CANCELLED'));

CREATE TABLE IF NOT EXISTS billing_account_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES student_invoices(id) ON DELETE SET NULL,
    session_package_id UUID REFERENCES student_session_packages(id) ON DELETE SET NULL,
    activity_type VARCHAR(32) NOT NULL CHECK (activity_type IN (
        'PACKAGE_PAUSED', 'PACKAGE_RESUMED', 'PACKAGE_EXTENDED', 'PACKAGE_TRANSFERRED',
        'PACKAGE_CANCELLED', 'CREDIT_ADJUSTMENT', 'REFUND_ISSUED', 'PAYMENT_REVERSED'
    )),
    amount NUMERIC(12, 2),
    from_value VARCHAR(160),
    to_value VARCHAR(160),
    reason VARCHAR(500) NOT NULL,
    actor_id UUID NOT NULL REFERENCES teachers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_account_activities_invoice
    ON billing_account_activities(invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_account_activities_student
    ON billing_account_activities(student_id, created_at DESC);
