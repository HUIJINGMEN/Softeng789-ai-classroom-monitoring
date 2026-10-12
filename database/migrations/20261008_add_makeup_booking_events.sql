ALTER TABLE lesson_credit_events
    DROP CONSTRAINT IF EXISTS lesson_credit_events_event_type_check;

ALTER TABLE lesson_credit_events
    ADD CONSTRAINT lesson_credit_events_event_type_check CHECK (event_type IN (
        'CREATED', 'PAYMENT_ACTIVATED', 'LESSON_BOOKED', 'ATTENDANCE_RECORDED', 'ABSENCE_COUNTED',
        'MAKEUP_APPROVED', 'MAKEUP_SCHEDULED', 'MAKEUP_RESCHEDULED', 'MAKEUP_CANCELLED',
        'MAKEUP_COMPLETED', 'SESSION_CANCELLED', 'MANUAL_ADJUSTMENT'
    ));
