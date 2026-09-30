-- ClassroomIQ presentation data
--
-- Safe to run more than once: rows owned by this script use reserved UUIDs and are reset to a
-- predictable presentation state, while existing accounts, passwords and user-created rows are
-- never deleted or overwritten.

BEGIN;

-- Courses/classes used by the presentation. Most development databases already have these; the
-- INSERTs make a fresh database work too without changing names entered by an existing user.
INSERT INTO courses (id, code, name)
VALUES
    ('d0100000-0000-4000-8000-000000000001', 'INFOSYS 222', 'INFOSYS 222'),
    ('d0100000-0000-4000-8000-000000000002', 'COMPSCI 335', 'COMPSCI 335'),
    ('d0100000-0000-4000-8000-000000000003', 'SOFTENG 789', 'SOFTENG 789')
ON CONFLICT DO NOTHING;

INSERT INTO course_offerings (id, course_id, offering_code, academic_term, status)
SELECT 'd0200000-0000-4000-8000-000000000001'::uuid, id, 'INFOSYS 222 2026', '2026 Teaching Year', 'ACTIVE'
FROM courses WHERE code = 'INFOSYS 222'
  AND NOT EXISTS (SELECT 1 FROM course_offerings WHERE offering_code = 'INFOSYS 222 2026')
UNION ALL
SELECT 'd0200000-0000-4000-8000-000000000002'::uuid, id, 'COMPSCI 335 2026 Teaching Year', '2026 Teaching Year', 'ACTIVE'
FROM courses WHERE code = 'COMPSCI 335'
  AND NOT EXISTS (SELECT 1 FROM course_offerings WHERE offering_code = 'COMPSCI 335 2026 Teaching Year')
UNION ALL
SELECT 'd0200000-0000-4000-8000-000000000003'::uuid, id, 'SOFTENG 789 2026', '2026 Teaching Year', 'ACTIVE'
FROM courses WHERE code = 'SOFTENG 789'
  AND NOT EXISTS (SELECT 1 FROM course_offerings WHERE offering_code = 'SOFTENG 789 2026')
ON CONFLICT DO NOTHING;

INSERT INTO campuses (id, name)
VALUES ('d0050000-0000-4000-8000-000000000001', 'City')
ON CONFLICT (name) DO NOTHING;

INSERT INTO rooms (id, campus_id, code, name, capacity)
SELECT room.id, campus.id, room.code, room.name, room.capacity
FROM (VALUES
    ('d0300000-0000-4000-8000-000000000001'::uuid, 'Lab 3', 'Engineering Computer Lab 3', 36),
    ('d0300000-0000-4000-8000-000000000002'::uuid, '303-G14', 'Science Centre 303-G14', 48),
    ('d0300000-0000-4000-8000-000000000003'::uuid, 'Case Room 2', 'Business School Case Room 2', 32)
) AS room(id, code, name, capacity)
CROSS JOIN campuses campus
WHERE campus.name = 'City'
ON CONFLICT (campus_id, code) DO UPDATE
SET name = EXCLUDED.name, capacity = EXCLUDED.capacity;

-- Known-password demo logins, so a fresh clone can sign in immediately instead of only getting a
-- passwordless Admin placeholder. Each guard checks for an existing row first (by whichever columns
-- are actually unique) so this never overwrites a password someone already set on their own machine
-- via the normal claim/registration flow.
UPDATE teachers SET password_hash = '$2a$10$6pAo8G/pATW8eKD5QUg3/.pePzm5v66BaX2HJz0AQoLLU3JspLR8S'
WHERE email = 'admin@auckland.ac.nz' AND password_hash IS NULL;

INSERT INTO teachers (staff_number, email, name, role, status, password_hash)
SELECT '1', '111@qq.com', 'Dr.1', 'TEACHER', 'ACTIVE',
       '$2a$10$4JOO8BMzRMQTwJS0sEnoG.Iuutw7zl1.gkxxj5LkjI3s2PaqmpbJa'
WHERE NOT EXISTS (SELECT 1 FROM teachers WHERE email = '111@qq.com' OR staff_number = '1');

INSERT INTO students (
    id, student_number, university_email, first_name, last_name, course, seat, programme, level,
    consent_given, face_enrollment_status, approval_status, status, password_hash, version,
    created_at, updated_at
)
SELECT 'd1000000-0000-4000-8000-000000000008', 'TEST-0001', 'test.student@aucklanduni.ac.nz', 'Test', -- NOSONAR: stable fixture key intentionally links demo records.
       'Student', 'COMPSCI 335', 'E01', 'Bachelor of Science', 'LEVEL_1', TRUE, 'VERIFIED',
       'APPROVED', 'ACTIVE', '$2a$10$XNij8ekDuqtEIxwlq9rJS..alNR/CLufpBxtn7WAnZJbtbxZxGmcS', 0, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM students WHERE university_email = 'test.student@aucklanduni.ac.nz' OR student_number = 'TEST-0001'
);

INSERT INTO course_enrollments (id, student_id, course_offering_id, status, enrolled_at)
SELECT gen_random_uuid(), s.id, co.id, 'ACTIVE', TIMESTAMPTZ '2026-07-20 09:00:00+12'
FROM students s
CROSS JOIN course_offerings co
WHERE s.university_email = 'test.student@aucklanduni.ac.nz'
  AND co.offering_code = 'COMPSCI 335 2026 Teaching Year'
ON CONFLICT (student_id, course_offering_id) DO UPDATE
SET status = 'ACTIVE', withdrawn_at = NULL;

-- Assign the demo teacher to their classes. These assignments only ensure that the presentation
-- records are visible to the intended teacher while an administrator continues to see the global view.
INSERT INTO course_offering_teachers (course_offering_id, teacher_id)
SELECT co.id, t.id
FROM course_offerings co
JOIN teachers t ON t.email = '111@qq.com'
WHERE co.offering_code = 'INFOSYS 222 2026'
ON CONFLICT DO NOTHING;

INSERT INTO course_offering_teachers (course_offering_id, teacher_id)
SELECT co.id, t.id
FROM course_offerings co
JOIN teachers t ON t.email = '111@qq.com'
WHERE co.offering_code = 'COMPSCI 335 2026 Teaching Year'
ON CONFLICT DO NOTHING;

INSERT INTO course_offering_teachers (course_offering_id, teacher_id)
SELECT co.id, t.id
FROM course_offerings co
JOIN teachers t ON t.email = 'teacher2@qq.com'
WHERE co.offering_code = 'SOFTENG 789 2026'
ON CONFLICT DO NOTHING;

-- Clean, recognisable roster entries for screenshots and live presentation. They intentionally do
-- not have passwords: they are classroom records, not additional accounts that can sign in.
WITH student_constants AS (
    SELECT
        'INFOSYS 222'::VARCHAR AS infosys_course,
        'COMPSCI 335'::VARCHAR AS compsci_course
),
programme_labels(code, label) AS (
    VALUES
        (1, 'Bachelor of Commerce'),
        (2, 'Bachelor of Science'),
        (3, 'Bachelor of Engineering')
),
student_seed(
    id, student_number, university_email, first_name, last_name, course, seat,
    programme_code, pending_approval
) AS (
    SELECT seed.*
    FROM student_constants constants
    CROSS JOIN LATERAL (
        VALUES
            ('d1000000-0000-4000-8000-000000000001'::uuid, 'DEMO-2601', 'ana.ngata.demo@auckland.ac.nz', 'Ana', 'Ngata', constants.infosys_course, 'A03', 1, FALSE),
            ('d1000000-0000-4000-8000-000000000002'::uuid, 'DEMO-2602', 'ethan.smith.demo@auckland.ac.nz', 'Ethan', 'Smith', constants.infosys_course, 'A07', 1, FALSE),
            ('d1000000-0000-4000-8000-000000000003'::uuid, 'DEMO-2603', 'ziyi.zhang.demo@auckland.ac.nz', 'Ziyi', 'Zhang', constants.compsci_course, 'B04', 2, FALSE),
            ('d1000000-0000-4000-8000-000000000004'::uuid, 'DEMO-2604', 'maia.rangi.demo@auckland.ac.nz', 'Maia', 'Rangi', constants.infosys_course, 'B09', 1, FALSE),
            ('d1000000-0000-4000-8000-000000000005'::uuid, 'DEMO-2605', 'noah.williams.demo@auckland.ac.nz', 'Noah', 'Williams', 'SOFTENG 789', 'C02', 3, FALSE),
            ('d1000000-0000-4000-8000-000000000006'::uuid, 'DEMO-2606', 'olivia.chen.demo@auckland.ac.nz', 'Olivia', 'Chen', constants.compsci_course, 'C08', 2, FALSE),
            ('d1000000-0000-4000-8000-000000000007'::uuid, 'DEMO-2607', 'liam.patel.demo@auckland.ac.nz', 'Liam', 'Patel', constants.infosys_course, 'D01', 1, TRUE)
    ) AS seed(
        id, student_number, university_email, first_name, last_name, course, seat,
        programme_code, pending_approval
    )
)
INSERT INTO students (
    id, student_number, university_email, first_name, last_name, course, seat, programme,
    consent_given, face_enrollment_status, approval_status, status, password_hash, version,
    created_at, updated_at
)
SELECT
    seed.id,
    seed.student_number,
    seed.university_email,
    seed.first_name,
    seed.last_name,
    seed.course,
    seed.seat,
    programme.label,
    TRUE,
    'VERIFIED',
    CASE WHEN seed.pending_approval THEN 'PENDING' ELSE 'APPROVED' END,
    'ACTIVE',
    NULL,
    0,
    NOW(),
    NOW()
FROM student_seed seed
JOIN programme_labels programme ON programme.code = seed.programme_code
ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    course = EXCLUDED.course,
    seat = EXCLUDED.seat,
    programme = EXCLUDED.programme,
    consent_given = EXCLUDED.consent_given,
    face_enrollment_status = EXCLUDED.face_enrollment_status,
    approval_status = EXCLUDED.approval_status,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Approved rosters. Liam's pending selection remains invisible until an administrator approves it.
INSERT INTO course_enrollments (id, student_id, course_offering_id, status, enrolled_at)
SELECT gen_random_uuid(), s.id, co.id, 'ACTIVE', TIMESTAMPTZ '2026-07-20 09:00:00+12'
FROM students s
CROSS JOIN course_offerings co
WHERE s.student_number IN ('DEMO-2601', 'DEMO-2602', 'DEMO-2604')
  AND co.offering_code = 'INFOSYS 222 2026'
ON CONFLICT (student_id, course_offering_id) DO UPDATE
SET status = 'ACTIVE', withdrawn_at = NULL;

INSERT INTO course_enrollments (id, student_id, course_offering_id, status, enrolled_at)
SELECT gen_random_uuid(), s.id, co.id, 'ACTIVE', TIMESTAMPTZ '2026-07-20 09:00:00+12'
FROM students s
CROSS JOIN course_offerings co
WHERE s.student_number IN ('DEMO-2601', 'DEMO-2603', 'DEMO-2606')
  AND co.offering_code = 'COMPSCI 335 2026 Teaching Year'
ON CONFLICT (student_id, course_offering_id) DO UPDATE
SET status = 'ACTIVE', withdrawn_at = NULL;

INSERT INTO course_enrollments (id, student_id, course_offering_id, status, enrolled_at)
SELECT gen_random_uuid(), s.id, co.id, 'ACTIVE', TIMESTAMPTZ '2026-07-20 09:00:00+12'
FROM students s
CROSS JOIN course_offerings co
WHERE s.student_number IN ('DEMO-2604', 'DEMO-2605')
  AND co.offering_code = 'SOFTENG 789 2026'
ON CONFLICT (student_id, course_offering_id) DO UPDATE
SET status = 'ACTIVE', withdrawn_at = NULL;

INSERT INTO course_enrollments (id, student_id, course_offering_id, status, enrolled_at)
SELECT 'd1800000-0000-4000-8000-000000000007', s.id, co.id, 'PENDING', TIMESTAMPTZ '2026-09-04 08:15:00+12'
FROM students s
CROSS JOIN course_offerings co
WHERE s.student_number = 'DEMO-2607'
  AND co.offering_code = 'INFOSYS 222 2026'
ON CONFLICT (student_id, course_offering_id) DO UPDATE
SET status = 'PENDING', withdrawn_at = NULL;

-- Sessions around the current presentation date (4 September 2026), giving Dashboard both a
-- useful "today" state and enough history for the trend and attendance views.
INSERT INTO classroom_sessions (
    id, course_name, room, course_offering_id, room_id, teacher_id,
    session_date, start_time, end_time, status
)
SELECT v.id, v.course_name, v.room, co.id, r.id, t.id, v.session_date, v.start_time, v.end_time, v.status
FROM (VALUES
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'INFOSYS 222', 'Lab 3', 'INFOSYS 222 2026', '111@qq.com', DATE '2026-09-04', TIMESTAMPTZ '2026-09-04 10:00:00+12', TIMESTAMPTZ '2026-09-04 11:30:00+12', 'ACTIVE'),
    ('d2000000-0000-4000-8000-000000000002'::uuid, 'INFOSYS 222', 'Case Room 2', 'INFOSYS 222 2026', '111@qq.com', DATE '2026-09-03', TIMESTAMPTZ '2026-09-03 14:00:00+12', TIMESTAMPTZ '2026-09-03 15:30:00+12', 'COMPLETED'),
    ('d2000000-0000-4000-8000-000000000003'::uuid, 'INFOSYS 222', 'Lab 3', 'INFOSYS 222 2026', '111@qq.com', DATE '2026-09-01', TIMESTAMPTZ '2026-09-01 10:00:00+12', TIMESTAMPTZ '2026-09-01 11:30:00+12', 'COMPLETED'),
    ('d2000000-0000-4000-8000-000000000004'::uuid, 'INFOSYS 222', 'Case Room 2', 'INFOSYS 222 2026', '111@qq.com', DATE '2026-08-28', TIMESTAMPTZ '2026-08-28 14:00:00+12', TIMESTAMPTZ '2026-08-28 15:30:00+12', 'COMPLETED'),
    ('d2000000-0000-4000-8000-000000000005'::uuid, 'INFOSYS 222', 'Lab 3', 'INFOSYS 222 2026', '111@qq.com', DATE '2026-09-05', TIMESTAMPTZ '2026-09-05 10:00:00+12', TIMESTAMPTZ '2026-09-05 11:30:00+12', 'SCHEDULED'),
    ('d2000000-0000-4000-8000-000000000011'::uuid, 'COMPSCI 335', '303-G14', 'COMPSCI 335 2026 Teaching Year', '111@qq.com', DATE '2026-09-04', TIMESTAMPTZ '2026-09-04 14:00:00+12', TIMESTAMPTZ '2026-09-04 15:00:00+12', 'SCHEDULED'),
    ('d2000000-0000-4000-8000-000000000012'::uuid, 'COMPSCI 335', '303-G14', 'COMPSCI 335 2026 Teaching Year', '111@qq.com', DATE '2026-09-03', TIMESTAMPTZ '2026-09-03 10:00:00+12', TIMESTAMPTZ '2026-09-03 11:00:00+12', 'COMPLETED'),
    ('d2000000-0000-4000-8000-000000000013'::uuid, 'COMPSCI 335', '303-G14', 'COMPSCI 335 2026 Teaching Year', '111@qq.com', DATE '2026-09-01', TIMESTAMPTZ '2026-09-01 14:00:00+12', TIMESTAMPTZ '2026-09-01 15:00:00+12', 'COMPLETED'),
    ('d2000000-0000-4000-8000-000000000014'::uuid, 'COMPSCI 335', '303-G14', 'COMPSCI 335 2026 Teaching Year', '111@qq.com', DATE '2026-08-28', TIMESTAMPTZ '2026-08-28 10:00:00+12', TIMESTAMPTZ '2026-08-28 11:00:00+12', 'COMPLETED'),
    ('d2000000-0000-4000-8000-000000000021'::uuid, 'SOFTENG 789', 'Lab 3', 'SOFTENG 789 2026', 'teacher2@qq.com', DATE '2026-09-04', TIMESTAMPTZ '2026-09-04 12:00:00+12', TIMESTAMPTZ '2026-09-04 13:00:00+12', 'COMPLETED')
) AS v(id, course_name, room, offering_code, teacher_email, session_date, start_time, end_time, status)
JOIN course_offerings co ON co.offering_code = v.offering_code
JOIN rooms r ON r.code = v.room
JOIN teachers t ON t.email = v.teacher_email
ON CONFLICT (id) DO UPDATE SET
    course_name = EXCLUDED.course_name,
    room = EXCLUDED.room,
    course_offering_id = EXCLUDED.course_offering_id,
    room_id = EXCLUDED.room_id,
    teacher_id = EXCLUDED.teacher_id,
    session_date = EXCLUDED.session_date,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    status = EXCLUDED.status;

-- Realistic attendance distribution for all approved students in the presentation sessions.
-- Pending registrations are deliberately excluded because they must not appear in a class roster.
INSERT INTO attendance_records (
    id, student_id, session_id, check_in_time, check_out_time, status, source
)
SELECT
    gen_random_uuid(),
    ce.student_id,
    cs.id,
    CASE WHEN marks.status IN ('PRESENT', 'LATE')
         THEN cs.start_time + CASE WHEN marks.status = 'LATE' THEN INTERVAL '8 minutes' ELSE INTERVAL '2 minutes' END
         ELSE NULL END,
    CASE WHEN marks.status IN ('PRESENT', 'LATE') AND cs.status = 'COMPLETED'
         THEN cs.end_time - INTERVAL '2 minutes' ELSE NULL END,
    marks.status,
    CASE WHEN marks.status = 'UNKNOWN' THEN 'MANUAL' ELSE 'AI' END
FROM classroom_sessions cs
JOIN course_enrollments ce ON ce.course_offering_id = cs.course_offering_id AND ce.status = 'ACTIVE'
JOIN students s ON s.id = ce.student_id AND s.approval_status = 'APPROVED' AND s.status = 'ACTIVE'
CROSS JOIN LATERAL (
    SELECT CASE
        WHEN RIGHT(s.student_number, 1) IN ('2', '7') AND EXTRACT(DAY FROM cs.session_date)::int % 2 = 1 THEN 'LATE'
        WHEN RIGHT(s.student_number, 1) IN ('4', '9') AND EXTRACT(DAY FROM cs.session_date)::int % 3 = 0 THEN 'ABSENT'
        WHEN RIGHT(s.student_number, 1) IN ('5') AND cs.session_date = DATE '2026-09-04' THEN 'UNKNOWN'
        ELSE 'PRESENT'
    END AS status
) marks
WHERE cs.id::text LIKE 'd2000000-0000-4000-8000-%'
  AND cs.status <> 'SCHEDULED'
ON CONFLICT (student_id, session_id) DO UPDATE SET
    check_in_time = EXCLUDED.check_in_time,
    check_out_time = EXCLUDED.check_out_time,
    status = EXCLUDED.status,
    source = EXCLUDED.source;

-- Give the demo student (test.student@aucklanduni.ac.nz) attendance history in every enrolled class,
-- including the
-- older sessions that pre-date this presentation dataset.
INSERT INTO attendance_records (
    id, student_id, session_id, check_in_time, check_out_time, status, source
)
SELECT
    gen_random_uuid(), s.id, cs.id,
    cs.start_time + CASE WHEN cs.session_date = DATE '2026-09-01' THEN INTERVAL '7 minutes' ELSE INTERVAL '2 minutes' END,
    CASE WHEN cs.status = 'COMPLETED' THEN cs.end_time - INTERVAL '2 minutes' ELSE NULL END,
    CASE WHEN cs.session_date = DATE '2026-09-01' THEN 'LATE' ELSE 'PRESENT' END,
    'AI'
FROM students s
JOIN course_enrollments ce ON ce.student_id = s.id AND ce.status = 'ACTIVE'
JOIN classroom_sessions cs ON cs.course_offering_id = ce.course_offering_id
WHERE s.university_email = 'test.student@aucklanduni.ac.nz'
  AND cs.status <> 'SCHEDULED'
ON CONFLICT (student_id, session_id) DO UPDATE SET
    check_in_time = EXCLUDED.check_in_time,
    check_out_time = EXCLUDED.check_out_time,
    status = EXCLUDED.status,
    source = EXCLUDED.source;

-- AI observation candidates. Shared labels are kept in one row so the seed remains easy to update
-- when the contract vocabulary or provider version changes.
WITH event_constants AS (
    SELECT
        'demo-1.0'::varchar AS model_version,
        'PENDING_REVIEW'::varchar AS pending_status,
        'CONFIRMED'::varchar AS confirmed_status,
        'Prolonged head-down posture'::varchar AS head_down_event,
        'Leaving the seat area'::varchar AS leaving_seat_event,
        'Potential peer interaction'::varchar AS peer_interaction_event,
        'd1000000-0000-4000-8000-000000000001'::uuid AS student_one_id,
        'd1000000-0000-4000-8000-000000000003'::uuid AS student_three_id,
        'd2000000-0000-4000-8000-000000000001'::uuid AS primary_session_id
),
event_seed(
    id, external_event_id, student_id, session_id, track_id, event_type, confidence,
    detected_at, duration_seconds, model_version, review_status, teacher_note
) AS (
    SELECT seed.*
    FROM event_constants constants
    CROSS JOIN LATERAL (VALUES
        ('d4000000-0000-4000-8000-000000000001'::uuid, 'demo-behaviour-001', constants.student_one_id, constants.primary_session_id, 'track-001', constants.head_down_event, 0.820::numeric, TIMESTAMPTZ '2026-09-04 10:15:24+12', 25, constants.model_version, constants.pending_status, NULL::text),
        ('d4000000-0000-4000-8000-000000000002'::uuid, 'demo-behaviour-002', 'd1000000-0000-4000-8000-000000000002'::uuid, constants.primary_session_id, 'track-002', constants.leaving_seat_event, 0.760::numeric, TIMESTAMPTZ '2026-09-04 10:18:47+12', 8, constants.model_version, constants.pending_status, NULL::text),
        ('d4000000-0000-4000-8000-000000000003'::uuid, 'demo-behaviour-003', 'd1000000-0000-4000-8000-000000000004'::uuid, constants.primary_session_id, 'track-003', constants.peer_interaction_event, 0.910::numeric, TIMESTAMPTZ '2026-09-04 10:22:31+12', 18, constants.model_version, constants.confirmed_status, 'Visible interaction confirmed after reviewing the evidence frame.'),
        ('d4000000-0000-4000-8000-000000000004'::uuid, 'demo-behaviour-004', 'd1000000-0000-4000-8000-000000000005'::uuid, constants.primary_session_id, 'track-004', 'Extended off-desk hand movement', 0.710::numeric, TIMESTAMPTZ '2026-09-04 10:27:05+12', 6, constants.model_version, 'REJECTED', 'Movement was related to retrieving course material.'),
        ('d4000000-0000-4000-8000-000000000005'::uuid, 'demo-behaviour-005', constants.student_three_id, constants.primary_session_id, 'track-005', constants.leaving_seat_event, 0.680::numeric, TIMESTAMPTZ '2026-09-04 10:31:02+12', 11, constants.model_version, 'CORRECTED', 'Corrected after reviewing the tracked seat region.'),
        ('d4000000-0000-4000-8000-000000000006'::uuid, 'demo-behaviour-006', constants.student_one_id, 'd2000000-0000-4000-8000-000000000002'::uuid, 'track-006', constants.peer_interaction_event, 0.870::numeric, TIMESTAMPTZ '2026-09-03 14:36:15+12', 14, constants.model_version, constants.confirmed_status, NULL::text),
        ('d4000000-0000-4000-8000-000000000007'::uuid, 'demo-behaviour-007', 'd1000000-0000-4000-8000-000000000004'::uuid, 'd2000000-0000-4000-8000-000000000003'::uuid, 'track-007', constants.head_down_event, 0.790::numeric, TIMESTAMPTZ '2026-09-01 10:42:08+12', 27, constants.model_version, constants.confirmed_status, NULL::text),
        ('d4000000-0000-4000-8000-000000000011'::uuid, 'demo-behaviour-011', constants.student_three_id, 'd2000000-0000-4000-8000-000000000012'::uuid, 'track-011', constants.head_down_event, 0.740::numeric, TIMESTAMPTZ '2026-09-03 10:21:14+12', 23, constants.model_version, constants.pending_status, NULL::text),
        ('d4000000-0000-4000-8000-000000000012'::uuid, 'demo-behaviour-012', constants.student_three_id, 'd2000000-0000-4000-8000-000000000012'::uuid, 'track-012', constants.leaving_seat_event, 0.890::numeric, TIMESTAMPTZ '2026-09-03 10:34:45+12', 9, constants.model_version, constants.confirmed_status, NULL::text),
        ('d4000000-0000-4000-8000-000000000013'::uuid, 'demo-behaviour-013', 'd1000000-0000-4000-8000-000000000006'::uuid, 'd2000000-0000-4000-8000-000000000013'::uuid, 'track-013', 'Extended off-desk hand movement', 0.670::numeric, TIMESTAMPTZ '2026-09-01 14:19:32+12', 7, constants.model_version, 'REJECTED', NULL::text),
        ('d4000000-0000-4000-8000-000000000014'::uuid, 'demo-behaviour-014', constants.student_one_id, 'd2000000-0000-4000-8000-000000000014'::uuid, 'track-014', constants.peer_interaction_event, 0.840::numeric, TIMESTAMPTZ '2026-08-28 10:41:03+12', 15, constants.model_version, 'CORRECTED', 'Corrected from prolonged head-down posture.')
    ) AS seed(
        id, external_event_id, student_id, session_id, track_id, event_type, confidence,
        detected_at, duration_seconds, model_version, review_status, teacher_note
    )
)
INSERT INTO behaviour_events (
    id, external_event_id, student_id, session_id, track_id, event_type, confidence, timestamp,
    duration_seconds, model_version, review_status, teacher_note
)
SELECT
    id, external_event_id, student_id, session_id, track_id, event_type, confidence, detected_at,
    duration_seconds, model_version, review_status, teacher_note
FROM event_seed
ON CONFLICT (id) DO UPDATE SET
    external_event_id = EXCLUDED.external_event_id,
    student_id = EXCLUDED.student_id,
    session_id = EXCLUDED.session_id,
    track_id = EXCLUDED.track_id,
    event_type = EXCLUDED.event_type,
    confidence = EXCLUDED.confidence,
    timestamp = EXCLUDED.timestamp,
    duration_seconds = EXCLUDED.duration_seconds,
    model_version = EXCLUDED.model_version,
    review_status = EXCLUDED.review_status,
    teacher_note = EXCLUDED.teacher_note;

-- AI health/safety candidates. A reviewed alert remains visible as review history; confirmed
-- candidates have a matching permanent incident report below.
WITH health_constants AS (
    SELECT
        'demo-health-1.0'::varchar AS model_version,
        'AI_SERVICE'::varchar AS source,
        'AWAITING_REVIEW'::varchar AS awaiting_review_status
),
health_seed(
    id, external_event_id, student_id, session_id, track_id, event_type, confidence, detected_at,
    duration_seconds, status, reviewed_at, teacher_notes, action_taken
) AS (
    SELECT seed.*
    FROM health_constants constants
    CROSS JOIN LATERAL (VALUES
        ('d5000000-0000-4000-8000-000000000001'::uuid, 'demo-health-001', 'd1000000-0000-4000-8000-000000000002'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'health-track-001', 'Fall detected', 0.930::numeric, TIMESTAMPTZ '2026-09-04 10:14:58+12', 8, constants.awaiting_review_status, NULL::timestamptz, NULL::text, NULL::text),
        ('d5000000-0000-4000-8000-000000000002'::uuid, 'demo-health-002', 'd1000000-0000-4000-8000-000000000004'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'health-track-002', 'Physical distress', 0.810::numeric, TIMESTAMPTZ '2026-09-04 10:38:12+12', 15, constants.awaiting_review_status, NULL::timestamptz, NULL::text, NULL::text),
        ('d5000000-0000-4000-8000-000000000003'::uuid, 'demo-health-003', 'd1000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000002'::uuid, 'health-track-003', 'Fainting risk', 0.880::numeric, TIMESTAMPTZ '2026-09-03 14:27:43+12', 12, 'CONFIRMED', TIMESTAMPTZ '2026-09-03 14:31:00+12', 'Student was conscious and responsive.', 'Assisted the student to a seat and contacted first aid.'),
        ('d5000000-0000-4000-8000-000000000004'::uuid, 'demo-health-004', 'd1000000-0000-4000-8000-000000000002'::uuid, 'd2000000-0000-4000-8000-000000000003'::uuid, 'health-track-004', 'Unusual movement', 0.640::numeric, TIMESTAMPTZ '2026-09-01 10:51:20+12', 6, 'DISMISSED', TIMESTAMPTZ '2026-09-01 10:54:00+12', 'Normal movement while packing course materials.', NULL::text),
        ('d5000000-0000-4000-8000-000000000011'::uuid, 'demo-health-011', 'd1000000-0000-4000-8000-000000000003'::uuid, 'd2000000-0000-4000-8000-000000000012'::uuid, 'health-track-011', 'Prolonged inactivity', 0.780::numeric, TIMESTAMPTZ '2026-09-03 10:43:18+12', 20, constants.awaiting_review_status, NULL::timestamptz, NULL::text, NULL::text)
    ) AS seed(
        id, external_event_id, student_id, session_id, track_id, event_type, confidence, detected_at,
        duration_seconds, status, reviewed_at, teacher_notes, action_taken
    )
)
INSERT INTO health_alerts (
    id, external_event_id, student_id, session_id, track_id, event_type, confidence, detected_at,
    duration_seconds, model_version, source, status, evidence_url, reviewed_by_teacher_id,
    reviewed_at, teacher_notes, action_taken, created_at
)
SELECT v.id, v.external_event_id, v.student_id, v.session_id, v.track_id, v.event_type,
       v.confidence, v.detected_at, v.duration_seconds, constants.model_version, constants.source,
       v.status, NULL, reviewer.id, v.reviewed_at, v.teacher_notes, v.action_taken, v.detected_at
FROM health_seed v
CROSS JOIN health_constants constants
LEFT JOIN teachers reviewer ON reviewer.email = CASE WHEN v.reviewed_at IS NULL THEN NULL ELSE '111@qq.com' END
ON CONFLICT (id) DO UPDATE SET
    external_event_id = EXCLUDED.external_event_id,
    student_id = EXCLUDED.student_id,
    session_id = EXCLUDED.session_id,
    track_id = EXCLUDED.track_id,
    event_type = EXCLUDED.event_type,
    confidence = EXCLUDED.confidence,
    detected_at = EXCLUDED.detected_at,
    duration_seconds = EXCLUDED.duration_seconds,
    model_version = EXCLUDED.model_version,
    source = EXCLUDED.source,
    status = EXCLUDED.status,
    evidence_url = EXCLUDED.evidence_url,
    reviewed_by_teacher_id = EXCLUDED.reviewed_by_teacher_id,
    reviewed_at = EXCLUDED.reviewed_at,
    teacher_notes = EXCLUDED.teacher_notes,
    action_taken = EXCLUDED.action_taken,
    created_at = EXCLUDED.created_at;

-- Permanent health records: one confirmed AI alert and several teacher-reported incidents.
INSERT INTO health_incident_reports (
    id, student_id, course_offering_id, session_id, teacher_id, source, incident_type,
    occurred_at, description, action_taken, teacher_notes, health_alert_id, created_at
)
SELECT v.id, v.student_id, co.id, v.session_id, t.id, v.source, v.incident_type,
       v.occurred_at, v.description, v.action_taken, v.teacher_notes, v.health_alert_id, v.created_at
FROM (VALUES
    ('d6000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 'INFOSYS 222 2026', 'd2000000-0000-4000-8000-000000000002'::uuid, '111@qq.com', 'AI_DETECTED', 'Fainting risk', TIMESTAMPTZ '2026-09-03 14:27:43+12', 'AI-detected event confirmed after teacher review.', 'Assisted the student to a seat and contacted first aid.', 'Student was conscious and responsive.', 'd5000000-0000-4000-8000-000000000003'::uuid, TIMESTAMPTZ '2026-09-03 14:31:00+12'),
    ('d6000000-0000-4000-8000-000000000002'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid, 'INFOSYS 222 2026', 'd2000000-0000-4000-8000-000000000003'::uuid, '111@qq.com', 'TEACHER_REPORTED', 'Nosebleed', TIMESTAMPTZ '2026-09-01 11:02:17+12', 'Teacher observed a student with a nosebleed during class.', 'Provided tissues and accompanied the student to the health centre.', 'Bleeding stopped after several minutes.', NULL::uuid, TIMESTAMPTZ '2026-09-01 11:08:00+12'),
    ('d6000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000004'::uuid, 'INFOSYS 222 2026', NULL::uuid, '111@qq.com', 'TEACHER_REPORTED', 'Physical distress', TIMESTAMPTZ '2026-08-28 13:52:00+12', 'Student reported feeling unwell before the session.', 'Contacted campus health and notified the course coordinator.', 'Student left class with a support person.', NULL::uuid, TIMESTAMPTZ '2026-08-28 14:05:00+12'),
    ('d6000000-0000-4000-8000-000000000011'::uuid, 'd1000000-0000-4000-8000-000000000003'::uuid, 'COMPSCI 335 2026 Teaching Year', 'd2000000-0000-4000-8000-000000000013'::uuid, '111@qq.com', 'TEACHER_REPORTED', 'Minor injury', TIMESTAMPTZ '2026-09-01 14:46:00+12', 'Student reported a minor cut while packing equipment.', 'Applied a first-aid dressing.', 'No further follow-up requested.', NULL::uuid, TIMESTAMPTZ '2026-09-01 14:51:00+12')
) AS v(id, student_id, offering_code, session_id, teacher_email, source, incident_type, occurred_at, description, action_taken, teacher_notes, health_alert_id, created_at)
JOIN course_offerings co ON co.offering_code = v.offering_code
JOIN teachers t ON t.email = v.teacher_email
ON CONFLICT (id) DO UPDATE SET
    student_id = EXCLUDED.student_id,
    course_offering_id = EXCLUDED.course_offering_id,
    session_id = EXCLUDED.session_id,
    teacher_id = EXCLUDED.teacher_id,
    source = EXCLUDED.source,
    incident_type = EXCLUDED.incident_type,
    occurred_at = EXCLUDED.occurred_at,
    description = EXCLUDED.description,
    action_taken = EXCLUDED.action_taken,
    teacher_notes = EXCLUDED.teacher_notes,
    health_alert_id = EXCLUDED.health_alert_id,
    created_at = EXCLUDED.created_at;

-- Feedback visible in both the class Reports tab and the student's own portal. Three records are
-- attached to test.student@aucklanduni.ac.nz so that account has meaningful content immediately.
INSERT INTO progress_reports (
    id, student_id, course_offering_id, teacher_id, comment, created_at
)
SELECT v.id, s.id, co.id, t.id, v.comment, v.created_at
FROM (VALUES
    ('d7000000-0000-4000-8000-000000000001'::uuid, 'test.student@aucklanduni.ac.nz', 'COMPSCI 335 2026 Teaching Year', '111@qq.com', 'You contributed a clear explanation during the group exercise. Keep connecting your implementation choices to the requirements.', TIMESTAMPTZ '2026-09-03 11:12:00+12'),
    ('d7000000-0000-4000-8000-000000000002'::uuid, 'test.student@aucklanduni.ac.nz', 'COMPSCI 335 2026 Teaching Year', '111@qq.com', 'Good progress on the service integration task. Review the error-handling path before the next lab.', TIMESTAMPTZ '2026-09-01 15:16:00+12'),
    ('d7000000-0000-4000-8000-000000000003'::uuid, 'test.student@aucklanduni.ac.nz', 'COMPSCI 335 2026 Teaching Year', '111@qq.com', 'Attendance and participation have been consistent this week. Your next step is to document the testing evidence more precisely.', TIMESTAMPTZ '2026-08-28 11:20:00+12'),
    ('d7000000-0000-4000-8000-000000000011'::uuid, 'ana.ngata.demo@auckland.ac.nz', 'INFOSYS 222 2026', '111@qq.com', 'Strong contribution to the case discussion. The process model was concise and easy for the group to follow.', TIMESTAMPTZ '2026-09-03 15:42:00+12'),
    ('d7000000-0000-4000-8000-000000000012'::uuid, 'ethan.smith.demo@auckland.ac.nz', 'INFOSYS 222 2026', '111@qq.com', 'Please revisit the stakeholder assumptions from today. Your analysis is on the right track but needs clearer evidence.', TIMESTAMPTZ '2026-09-01 11:38:00+12'),
    ('d7000000-0000-4000-8000-000000000013'::uuid, 'ziyi.zhang.demo@auckland.ac.nz', 'COMPSCI 335 2026 Teaching Year', '111@qq.com', 'Your debugging notes were thorough and helped the group isolate the issue quickly.', TIMESTAMPTZ '2026-09-03 11:25:00+12')
) AS v(id, student_email, offering_code, teacher_email, comment, created_at)
JOIN students s ON s.university_email = v.student_email
JOIN course_offerings co ON co.offering_code = v.offering_code
JOIN teachers t ON t.email = v.teacher_email
ON CONFLICT (id) DO UPDATE SET
    student_id = EXCLUDED.student_id,
    course_offering_id = EXCLUDED.course_offering_id,
    teacher_id = EXCLUDED.teacher_id,
    comment = EXCLUDED.comment,
    created_at = EXCLUDED.created_at;

-- Confirmed and draft accomplishments demonstrate the staff review boundary and give the current
-- test.student@aucklanduni.ac.nz account meaningful student-portal content immediately.
INSERT INTO accomplishments (
    id, student_id, course_offering_id, created_by_teacher_id, confirmed_by_teacher_id,
    category, title, description, student_note, points, achievement_date,
    include_in_report, status, created_at, confirmed_at
)
SELECT v.id, s.id, co.id, t.id,
       CASE WHEN v.status = 'CONFIRMED' THEN t.id ELSE NULL END,
       v.category, v.title, v.description, v.student_note, v.points, v.achievement_date,
       TRUE, v.status, v.created_at,
       CASE WHEN v.status = 'CONFIRMED' THEN v.created_at + INTERVAL '20 minutes' ELSE NULL END
FROM (VALUES
    ('d8000000-0000-4000-8000-000000000001'::uuid, 'test.student@aucklanduni.ac.nz', 'COMPSCI 335 2026 Teaching Year', '111@qq.com', 'PROJECT', 'Completed the service integration project', 'Delivered the end-to-end service integration milestone with documented test evidence.', 'A clear implementation with thoughtful error handling.', 30.00::numeric, DATE '2026-09-07', 'CONFIRMED', TIMESTAMPTZ '2026-09-07 13:20:00+12'),
    ('d8000000-0000-4000-8000-000000000002'::uuid, 'test.student@aucklanduni.ac.nz', 'COMPSCI 335 2026 Teaching Year', '111@qq.com', 'MILESTONE', 'First full-stack workflow demonstrated', 'Connected the frontend workflow to the backend and demonstrated the complete user path.', NULL::text, NULL::numeric, DATE '2026-09-03', 'CONFIRMED', TIMESTAMPTZ '2026-09-03 15:40:00+12'),
    ('d8000000-0000-4000-8000-000000000011'::uuid, 'ana.ngata.demo@auckland.ac.nz', 'INFOSYS 222 2026', '111@qq.com', 'LEADERSHIP', 'Led the stakeholder workshop', 'Facilitated the group workshop and kept the discussion focused on evidence.', 'Strong preparation and inclusive facilitation.', 10.00::numeric, DATE '2026-09-04', 'CONFIRMED', TIMESTAMPTZ '2026-09-04 16:10:00+12'),
    ('d8000000-0000-4000-8000-000000000012'::uuid, 'ethan.smith.demo@auckland.ac.nz', 'INFOSYS 222 2026', '111@qq.com', 'PROJECT', 'Completed the process analysis project', 'Submitted the complete process analysis and supporting evidence.', NULL::text, 26.00::numeric, DATE '2026-09-05', 'DRAFT', TIMESTAMPTZ '2026-09-05 14:15:00+12')
) AS v(id, student_email, offering_code, teacher_email, category, title, description, student_note, points, achievement_date, status, created_at)
JOIN students s ON s.university_email = v.student_email
JOIN course_offerings co ON co.offering_code = v.offering_code
JOIN teachers t ON t.email = v.teacher_email
ON CONFLICT (id) DO UPDATE SET
    category = EXCLUDED.category,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    student_note = EXCLUDED.student_note,
    points = EXCLUDED.points,
    achievement_date = EXCLUDED.achievement_date,
    include_in_report = EXCLUDED.include_in_report,
    status = EXCLUDED.status,
    confirmed_by_teacher_id = EXCLUDED.confirmed_by_teacher_id,
    confirmed_at = EXCLUDED.confirmed_at;

-- Student responses demonstrate both sides of the workflow: the first accomplishment has been
-- acknowledged, while the second has a correction request waiting for its teacher.
INSERT INTO accomplishment_feedback (
    id, accomplishment_id, type, status, message, created_at
)
SELECT
    'd8100000-0000-4000-8000-000000000001'::uuid,
    accomplishments.id,
    'ACKNOWLEDGEMENT',
    'RECORDED',
    NULL,
    TIMESTAMPTZ '2026-09-08 09:15:00+12'
FROM accomplishments
WHERE accomplishments.id = 'd8000000-0000-4000-8000-000000000011'
UNION ALL
SELECT
    'd8100000-0000-4000-8000-000000000002'::uuid,
    accomplishments.id,
    'CORRECTION_REQUEST',
    'PENDING',
    'The workshop was completed on 3 September rather than 4 September. Could the date be updated?',
    TIMESTAMPTZ '2026-09-05 10:05:00+12'
FROM accomplishments
WHERE accomplishments.id = 'd8000000-0000-4000-8000-000000000011'
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    message = EXCLUDED.message,
    created_at = EXCLUDED.created_at;

-- A concise student statement: one open invoice with a scholarship credit and partial payment,
-- plus one paid historical invoice. The payment provider remains DEMO and stores no card data.
INSERT INTO student_invoices (
    id, student_id, created_by_admin_id, title, note, due_date, currency, status, created_at, updated_at, version
)
SELECT v.id, s.id, admin.id, v.title, v.note, v.due_date, 'NZD', v.status, v.created_at, v.created_at, 0
FROM (VALUES
    ('d9000000-0000-4000-8000-000000000001'::uuid, 'TEST-0001', '2026 Semester Two fees', 'Tuition and course-related charges for the current teaching period.', DATE '2026-10-20', 'PARTIALLY_PAID', TIMESTAMPTZ '2026-09-20 09:00:00+12'), -- NOSONAR: stable invoice key is reused by related fixture rows.
    ('d9000000-0000-4000-8000-000000000002'::uuid, 'TEST-0001', '2026 Semester One fees', 'Paid in full.', DATE '2026-03-20', 'PAID', TIMESTAMPTZ '2026-02-20 09:00:00+13'), -- NOSONAR: stable invoice key is reused by related fixture rows.
    ('d9000000-0000-4000-8000-000000000003'::uuid, 'DEMO-2601', 'Library replacement charge', 'Please settle this account item.', DATE '2026-09-10', 'OVERDUE', TIMESTAMPTZ '2026-08-28 09:00:00+12')
) AS v(id, student_number, title, note, due_date, status, created_at)
JOIN students s ON s.student_number = v.student_number
JOIN teachers admin ON admin.email = 'admin@auckland.ac.nz'
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    note = EXCLUDED.note,
    due_date = EXCLUDED.due_date,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO invoice_line_items (id, invoice_id, description, type, amount, position)
VALUES
    ('d9100000-0000-4000-8000-000000000001', 'd9000000-0000-4000-8000-000000000001', 'Tuition fee', 'CHARGE', 4200.00, 0), -- NOSONAR: repeated enum and fixture key are intentional seed data.
    ('d9100000-0000-4000-8000-000000000002', 'd9000000-0000-4000-8000-000000000001', 'COMPSCI 335 course fee', 'CHARGE', 180.00, 1),
    ('d9100000-0000-4000-8000-000000000003', 'd9000000-0000-4000-8000-000000000001', 'Laboratory materials', 'CHARGE', 90.00, 2),
    ('d9100000-0000-4000-8000-000000000004', 'd9000000-0000-4000-8000-000000000001', 'Faculty scholarship', 'CREDIT', 500.00, 3),
    ('d9100000-0000-4000-8000-000000000005', 'd9000000-0000-4000-8000-000000000002', 'Semester One tuition', 'CHARGE', 3970.00, 0),
    ('d9100000-0000-4000-8000-000000000006', 'd9000000-0000-4000-8000-000000000003', 'Library book replacement', 'CHARGE', 85.00, 0)
ON CONFLICT (id) DO UPDATE SET
    description = EXCLUDED.description,
    type = EXCLUDED.type,
    amount = EXCLUDED.amount,
    position = EXCLUDED.position;

INSERT INTO payment_transactions (
    id, invoice_id, amount, status, provider, provider_reference, occurred_at
)
VALUES
    ('d9200000-0000-4000-8000-000000000001', 'd9000000-0000-4000-8000-000000000001', 1000.00, 'SUCCEEDED', 'DEMO', 'demo-part-payment-2026-s2', TIMESTAMPTZ '2026-09-22 14:15:00+12'),
    ('d9200000-0000-4000-8000-000000000002', 'd9000000-0000-4000-8000-000000000002', 3970.00, 'SUCCEEDED', 'DEMO', 'demo-paid-2026-s1', TIMESTAMPTZ '2026-03-12 11:20:00+13')
ON CONFLICT (id) DO UPDATE SET
    amount = EXCLUDED.amount,
    status = EXCLUDED.status,
    provider = EXCLUDED.provider,
    provider_reference = EXCLUDED.provider_reference,
    occurred_at = EXCLUDED.occurred_at;

COMMIT;
