-- Stable, idempotent contract fields for behaviour observations emitted by the AI service.
ALTER TABLE behaviour_events
    ADD COLUMN IF NOT EXISTS external_event_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS track_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS evidence_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS model_version VARCHAR(80);

UPDATE behaviour_events
SET external_event_id = COALESCE(external_event_id, 'legacy-' || id::text),
    track_id = COALESCE(track_id, 'legacy-unlinked'),
    model_version = COALESCE(model_version, 'legacy/unknown');

ALTER TABLE behaviour_events
    ALTER COLUMN external_event_id SET NOT NULL,
    ALTER COLUMN track_id SET NOT NULL,
    ALTER COLUMN model_version SET NOT NULL;

ALTER TABLE behaviour_events
    DROP CONSTRAINT IF EXISTS behaviour_events_external_event_id_unique,
    DROP CONSTRAINT IF EXISTS behaviour_events_duration_nonnegative;

ALTER TABLE behaviour_events
    ADD CONSTRAINT behaviour_events_external_event_id_unique UNIQUE (external_event_id),
    ADD CONSTRAINT behaviour_events_duration_nonnegative CHECK (duration_seconds >= 0);

CREATE INDEX IF NOT EXISTS idx_behaviour_events_track_id ON behaviour_events(track_id);
