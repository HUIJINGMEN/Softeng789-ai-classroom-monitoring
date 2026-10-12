ALTER TABLE student_invoices
    ADD COLUMN IF NOT EXISTS message_draft_saved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_delivery_key VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_delivery_status VARCHAR(16);
