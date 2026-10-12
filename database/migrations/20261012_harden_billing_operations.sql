-- Phase 3 hardening: protect package lifecycle changes and retain external refund evidence.
ALTER TABLE student_session_packages
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE billing_account_activities
    ADD COLUMN IF NOT EXISTS external_reference VARCHAR(120);
