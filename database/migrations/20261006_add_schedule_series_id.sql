-- Links generated session occurrences back to one weekly timetable slot. Existing sessions remain
-- one-off records because their original recurrence relationship cannot be inferred safely.
ALTER TABLE classroom_sessions
    ADD COLUMN IF NOT EXISTS schedule_series_id UUID;

CREATE INDEX IF NOT EXISTS idx_classroom_sessions_schedule_series
    ON classroom_sessions(schedule_series_id, session_date)
    WHERE schedule_series_id IS NOT NULL;

-- Older versions of the timetable builder stored only concrete sessions. Link an old pattern only
-- when it is unambiguous: at least two still-scheduled occurrences, exactly seven days apart,
-- with the same class, weekday, clock time, room and teacher. Irregular and historical sessions
-- remain unlinked so an administrator cannot accidentally batch-edit them.
WITH recurring_groups AS (
    SELECT
        course_offering_id,
        EXTRACT(ISODOW FROM session_date) AS weekday,
        start_time::time AS start_clock,
        end_time::time AS end_clock,
        room_id,
        teacher_id,
        gen_random_uuid() AS series_id
    FROM classroom_sessions
    WHERE schedule_series_id IS NULL
      AND status = 'SCHEDULED'
      AND course_offering_id IS NOT NULL
    GROUP BY
        course_offering_id,
        EXTRACT(ISODOW FROM session_date),
        start_time::time,
        end_time::time,
        room_id,
        teacher_id
    HAVING COUNT(*) >= 2
       AND MAX(session_date) - MIN(session_date) = 7 * (COUNT(*) - 1)
)
UPDATE classroom_sessions AS session
SET schedule_series_id = recurring.series_id
FROM recurring_groups AS recurring
WHERE session.schedule_series_id IS NULL
  AND session.status = 'SCHEDULED'
  AND session.course_offering_id = recurring.course_offering_id
  AND EXTRACT(ISODOW FROM session.session_date) = recurring.weekday
  AND session.start_time::time = recurring.start_clock
  AND session.end_time::time = recurring.end_clock
  AND session.room_id IS NOT DISTINCT FROM recurring.room_id
  AND session.teacher_id IS NOT DISTINCT FROM recurring.teacher_id;
