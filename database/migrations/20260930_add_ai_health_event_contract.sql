-- Stable, idempotent contract fields for health warning candidates emitted by the AI service.
ALTER TABLE health_alerts
    ADD COLUMN IF NOT EXISTS external_event_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS track_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS model_version VARCHAR(80);

UPDATE health_alerts
SET external_event_id = COALESCE(external_event_id, 'legacy-health-' || id::text),
    track_id = COALESCE(track_id, 'legacy-unlinked'),
    model_version = COALESCE(model_version, 'legacy/unknown')
WHERE external_event_id IS NULL
   OR track_id IS NULL
   OR model_version IS NULL;

ALTER TABLE health_alerts
    ALTER COLUMN external_event_id SET NOT NULL,
    ALTER COLUMN track_id SET NOT NULL,
    ALTER COLUMN model_version SET NOT NULL;

ALTER TABLE health_alerts
    DROP CONSTRAINT IF EXISTS health_alerts_duration_nonnegative;
ALTER TABLE health_alerts
    ADD CONSTRAINT health_alerts_duration_nonnegative CHECK (duration_seconds >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_health_alerts_external_event_id
    ON health_alerts(external_event_id);
CREATE INDEX IF NOT EXISTS idx_health_alerts_track_id ON health_alerts(track_id);
