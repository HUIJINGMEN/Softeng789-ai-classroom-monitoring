BEGIN;

ALTER TABLE student_learning_entitlements
    ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES student_invoices(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS line_item_id UUID REFERENCES invoice_line_items(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

-- Preserve every existing one-course invoice before removing the legacy single-value link. The
-- guard also makes this migration safe on databases created from the latest schema.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'student_invoices' AND column_name = 'entitlement_id'
    ) THEN
        EXECUTE '
            UPDATE student_learning_entitlements entitlement
            SET invoice_id = invoice.id
            FROM student_invoices invoice
            WHERE invoice.entitlement_id = entitlement.id
              AND entitlement.invoice_id IS NULL';
    END IF;
END $$;

ALTER TABLE student_session_packages
    ADD COLUMN IF NOT EXISTS entitlement_id UUID REFERENCES student_learning_entitlements(id) ON DELETE CASCADE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'student_invoices' AND column_name = 'entitlement_id'
    ) THEN
        EXECUTE '
            UPDATE student_session_packages package
            SET entitlement_id = invoice.entitlement_id
            FROM student_invoices invoice
            WHERE package.invoice_id = invoice.id
              AND package.entitlement_id IS NULL';
    END IF;
END $$;

ALTER TABLE student_session_packages
    DROP CONSTRAINT IF EXISTS student_session_packages_invoice_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_session_packages_entitlement
    ON student_session_packages(entitlement_id)
    WHERE entitlement_id IS NOT NULL;

DROP INDEX IF EXISTS idx_student_invoices_entitlement;
ALTER TABLE student_invoices DROP COLUMN IF EXISTS entitlement_id;

CREATE INDEX IF NOT EXISTS idx_learning_entitlements_invoice
    ON student_learning_entitlements(invoice_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_entitlements_line_item
    ON student_learning_entitlements(line_item_id)
    WHERE line_item_id IS NOT NULL;

COMMIT;
