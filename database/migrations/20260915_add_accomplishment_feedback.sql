BEGIN;

-- Adds the student acknowledgement and correction-request workflow without changing existing
-- accomplishment or report data. Safe to run more than once in a development environment.
CREATE TABLE IF NOT EXISTS accomplishment_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accomplishment_id UUID NOT NULL REFERENCES accomplishments(id) ON DELETE CASCADE,
    type VARCHAR(24) NOT NULL CHECK (type IN ('ACKNOWLEDGEMENT', 'CORRECTION_REQUEST')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('RECORDED', 'PENDING', 'ACCEPTED', 'DECLINED')),
    message TEXT,
    staff_response TEXT,
    reviewed_by_teacher_id UUID REFERENCES teachers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_accomplishment_feedback_accomplishment
    ON accomplishment_feedback(accomplishment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accomplishment_feedback_ack_unique
    ON accomplishment_feedback(accomplishment_id)
    WHERE type = 'ACKNOWLEDGEMENT';
CREATE UNIQUE INDEX IF NOT EXISTS idx_accomplishment_feedback_pending_unique
    ON accomplishment_feedback(accomplishment_id)
    WHERE type = 'CORRECTION_REQUEST' AND status = 'PENDING';

COMMIT;
