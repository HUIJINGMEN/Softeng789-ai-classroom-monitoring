-- Explicit, backed-up, pre-Flyway alignment of the inspected local legacy variant only.
-- No business row UPDATE/DELETE. Constraints validate all rows; orphans abort the transaction.
SET LOCAL search_path TO public;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='classroom_sessions'::regclass AND contype='f'
                   AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='classroom_sessions'::regclass AND attname='course_offering_id')]::smallint[]) THEN
        ALTER TABLE classroom_sessions ADD CONSTRAINT classroom_sessions_course_offering_id_fkey
            FOREIGN KEY (course_offering_id) REFERENCES course_offerings(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='classroom_sessions'::regclass AND contype='f'
                   AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='classroom_sessions'::regclass AND attname='room_id')]::smallint[]) THEN
        ALTER TABLE classroom_sessions ADD CONSTRAINT classroom_sessions_room_id_fkey
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='classroom_sessions'::regclass AND contype='f'
                   AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='classroom_sessions'::regclass AND attname='teacher_id')]::smallint[]) THEN
        ALTER TABLE classroom_sessions ADD CONSTRAINT classroom_sessions_teacher_id_fkey
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
    END IF;
END $$;
ALTER TABLE lesson_credit_events DROP CONSTRAINT lesson_credit_events_event_type_check;
ALTER TABLE lesson_credit_events ADD CONSTRAINT lesson_credit_events_event_type_check CHECK (event_type IN (
    'CREATED','PAYMENT_ACTIVATED','LESSON_BOOKED','ATTENDANCE_RECORDED','ABSENCE_COUNTED',
    'MAKEUP_APPROVED','MAKEUP_SCHEDULED','MAKEUP_RESCHEDULED','MAKEUP_CANCELLED','MAKEUP_COMPLETED',
    'SESSION_CANCELLED','MANUAL_ADJUSTMENT'
));
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
