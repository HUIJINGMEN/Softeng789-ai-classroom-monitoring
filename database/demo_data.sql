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

-- Keep the existing login accounts. These assignments only ensure that the presentation records
-- are visible to the intended teacher while an administrator continues to see the global view.
INSERT INTO course_offering_teachers (course_offering_id, teacher_id)
SELECT co.id, t.id
FROM course_offerings co
JOIN teachers t ON t.email = '111@qq.com'
WHERE co.offering_code = 'INFOSYS 222 2026'
ON CONFLICT DO NOTHING;

INSERT INTO course_offering_teachers (course_offering_id, teacher_id)
SELECT co.id, t.id
FROM course_offerings co
JOIN teachers t ON t.email = 'hmen498@aucklanduni.ac.nz'
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
INSERT INTO students (
    id, student_number, university_email, first_name, last_name, course, seat, programme,
    consent_given, face_enrollment_status, approval_status, status, password_hash, version,
    created_at, updated_at
)
VALUES
    ('d1000000-0000-4000-8000-000000000001', 'DEMO-2601', 'ana.ngata.demo@auckland.ac.nz', 'Ana', 'Ngata', 'INFOSYS 222', 'A03', 'Bachelor of Commerce', TRUE, 'PHOTO_CAPTURED', 'APPROVED', 'ACTIVE', NULL, 0, NOW(), NOW()),
    ('d1000000-0000-4000-8000-000000000002', 'DEMO-2602', 'ethan.smith.demo@auckland.ac.nz', 'Ethan', 'Smith', 'INFOSYS 222', 'A07', 'Bachelor of Commerce', TRUE, 'PHOTO_CAPTURED', 'APPROVED', 'ACTIVE', NULL, 0, NOW(), NOW()),
    ('d1000000-0000-4000-8000-000000000003', 'DEMO-2603', 'ziyi.zhang.demo@auckland.ac.nz', 'Ziyi', 'Zhang', 'COMPSCI 335', 'B04', 'Bachelor of Science', TRUE, 'PHOTO_CAPTURED', 'APPROVED', 'ACTIVE', NULL, 0, NOW(), NOW()),
    ('d1000000-0000-4000-8000-000000000004', 'DEMO-2604', 'maia.rangi.demo@auckland.ac.nz', 'Maia', 'Rangi', 'INFOSYS 222', 'B09', 'Bachelor of Commerce', TRUE, 'PHOTO_CAPTURED', 'APPROVED', 'ACTIVE', NULL, 0, NOW(), NOW()),
    ('d1000000-0000-4000-8000-000000000005', 'DEMO-2605', 'noah.williams.demo@auckland.ac.nz', 'Noah', 'Williams', 'SOFTENG 789', 'C02', 'Bachelor of Engineering', TRUE, 'PHOTO_CAPTURED', 'APPROVED', 'ACTIVE', NULL, 0, NOW(), NOW()),
    ('d1000000-0000-4000-8000-000000000006', 'DEMO-2606', 'olivia.chen.demo@auckland.ac.nz', 'Olivia', 'Chen', 'COMPSCI 335', 'C08', 'Bachelor of Science', TRUE, 'PHOTO_CAPTURED', 'APPROVED', 'ACTIVE', NULL, 0, NOW(), NOW()),
    ('d1000000-0000-4000-8000-000000000007', 'DEMO-2607', 'liam.patel.demo@auckland.ac.nz', 'Liam', 'Patel', 'INFOSYS 222', 'D01', 'Bachelor of Commerce', TRUE, 'PHOTO_CAPTURED', 'PENDING', 'ACTIVE', NULL, 0, NOW(), NOW())
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
    ('d2000000-0000-4000-8000-000000000011'::uuid, 'COMPSCI 335', '303-G14', 'COMPSCI 335 2026 Teaching Year', 'hmen498@aucklanduni.ac.nz', DATE '2026-09-04', TIMESTAMPTZ '2026-09-04 14:00:00+12', TIMESTAMPTZ '2026-09-04 15:00:00+12', 'SCHEDULED'),
    ('d2000000-0000-4000-8000-000000000012'::uuid, 'COMPSCI 335', '303-G14', 'COMPSCI 335 2026 Teaching Year', 'hmen498@aucklanduni.ac.nz', DATE '2026-09-03', TIMESTAMPTZ '2026-09-03 10:00:00+12', TIMESTAMPTZ '2026-09-03 11:00:00+12', 'COMPLETED'),
    ('d2000000-0000-4000-8000-000000000013'::uuid, 'COMPSCI 335', '303-G14', 'COMPSCI 335 2026 Teaching Year', 'hmen498@aucklanduni.ac.nz', DATE '2026-09-01', TIMESTAMPTZ '2026-09-01 14:00:00+12', TIMESTAMPTZ '2026-09-01 15:00:00+12', 'COMPLETED'),
    ('d2000000-0000-4000-8000-000000000014'::uuid, 'COMPSCI 335', '303-G14', 'COMPSCI 335 2026 Teaching Year', 'hmen498@aucklanduni.ac.nz', DATE '2026-08-28', TIMESTAMPTZ '2026-08-28 10:00:00+12', TIMESTAMPTZ '2026-08-28 11:00:00+12', 'COMPLETED'),
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

-- Give the currently used teststudent account history in every selected class, including the
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
WHERE s.university_email = '000@qq.com'
  AND cs.status <> 'SCHEDULED'
ON CONFLICT (student_id, session_id) DO UPDATE SET
    check_in_time = EXCLUDED.check_in_time,
    check_out_time = EXCLUDED.check_out_time,
    status = EXCLUDED.status,
    source = EXCLUDED.source;

-- AI observation candidates. Exact event names match the neutral, observable language used by
-- the review UI; statuses intentionally cover every filter and report rule.
INSERT INTO behaviour_events (
    id, student_id, session_id, event_type, confidence, timestamp, review_status, teacher_note
)
VALUES
    ('d4000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Prolonged head-down posture', 0.820, TIMESTAMPTZ '2026-09-04 10:15:24+12', 'PENDING_REVIEW', NULL),
    ('d4000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000001', 'Leaving the seat area', 0.760, TIMESTAMPTZ '2026-09-04 10:18:47+12', 'PENDING_REVIEW', NULL),
    ('d4000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000001', 'Potential peer interaction', 0.910, TIMESTAMPTZ '2026-09-04 10:22:31+12', 'CONFIRMED', 'Visible interaction confirmed after reviewing the evidence frame.'),
    ('d4000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000005', 'd2000000-0000-4000-8000-000000000001', 'Extended off-desk hand movement', 0.710, TIMESTAMPTZ '2026-09-04 10:27:05+12', 'REJECTED', 'Movement was related to retrieving course material.'),
    ('d4000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000001', 'Leaving the seat area', 0.680, TIMESTAMPTZ '2026-09-04 10:31:02+12', 'CORRECTED', 'Corrected after reviewing the tracked seat region.'),
    ('d4000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002', 'Potential peer interaction', 0.870, TIMESTAMPTZ '2026-09-03 14:36:15+12', 'CONFIRMED', NULL),
    ('d4000000-0000-4000-8000-000000000007', 'd1000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000003', 'Prolonged head-down posture', 0.790, TIMESTAMPTZ '2026-09-01 10:42:08+12', 'CONFIRMED', NULL),
    ('d4000000-0000-4000-8000-000000000011', 'd1000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000012', 'Prolonged head-down posture', 0.740, TIMESTAMPTZ '2026-09-03 10:21:14+12', 'PENDING_REVIEW', NULL),
    ('d4000000-0000-4000-8000-000000000012', 'd1000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000012', 'Leaving the seat area', 0.890, TIMESTAMPTZ '2026-09-03 10:34:45+12', 'CONFIRMED', NULL),
    ('d4000000-0000-4000-8000-000000000013', 'd1000000-0000-4000-8000-000000000006', 'd2000000-0000-4000-8000-000000000013', 'Extended off-desk hand movement', 0.670, TIMESTAMPTZ '2026-09-01 14:19:32+12', 'REJECTED', NULL),
    ('d4000000-0000-4000-8000-000000000014', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000014', 'Potential peer interaction', 0.840, TIMESTAMPTZ '2026-08-28 10:41:03+12', 'CORRECTED', 'Corrected from prolonged head-down posture.')
ON CONFLICT (id) DO UPDATE SET
    student_id = EXCLUDED.student_id,
    session_id = EXCLUDED.session_id,
    event_type = EXCLUDED.event_type,
    confidence = EXCLUDED.confidence,
    timestamp = EXCLUDED.timestamp,
    review_status = EXCLUDED.review_status,
    teacher_note = EXCLUDED.teacher_note;

-- AI health/safety candidates. A reviewed alert remains visible as review history; confirmed
-- candidates have a matching permanent incident report below.
INSERT INTO health_alerts (
    id, student_id, session_id, event_type, confidence, detected_at, source, status,
    evidence_url, reviewed_by_teacher_id, reviewed_at, teacher_notes, action_taken, created_at
)
SELECT v.id, v.student_id, v.session_id, v.event_type, v.confidence, v.detected_at,
       'AI_SERVICE', v.status, NULL, reviewer.id, v.reviewed_at, v.teacher_notes, v.action_taken,
       v.detected_at
FROM (VALUES
    ('d5000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'Fall detected', 0.930::numeric, TIMESTAMPTZ '2026-09-04 10:14:58+12', 'AWAITING_REVIEW', NULL::timestamptz, NULL::text, NULL::text),
    ('d5000000-0000-4000-8000-000000000002'::uuid, 'd1000000-0000-4000-8000-000000000004'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'Physical distress', 0.810::numeric, TIMESTAMPTZ '2026-09-04 10:38:12+12', 'AWAITING_REVIEW', NULL::timestamptz, NULL::text, NULL::text),
    ('d5000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000002'::uuid, 'Fainting risk', 0.880::numeric, TIMESTAMPTZ '2026-09-03 14:27:43+12', 'CONFIRMED', TIMESTAMPTZ '2026-09-03 14:31:00+12', 'Student was conscious and responsive.', 'Assisted the student to a seat and contacted first aid.'),
    ('d5000000-0000-4000-8000-000000000004'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid, 'd2000000-0000-4000-8000-000000000003'::uuid, 'Unusual movement', 0.640::numeric, TIMESTAMPTZ '2026-09-01 10:51:20+12', 'DISMISSED', TIMESTAMPTZ '2026-09-01 10:54:00+12', 'Normal movement while packing course materials.', NULL::text),
    ('d5000000-0000-4000-8000-000000000011'::uuid, 'd1000000-0000-4000-8000-000000000003'::uuid, 'd2000000-0000-4000-8000-000000000012'::uuid, 'Prolonged inactivity', 0.780::numeric, TIMESTAMPTZ '2026-09-03 10:43:18+12', 'AWAITING_REVIEW', NULL::timestamptz, NULL::text, NULL::text)
) AS v(id, student_id, session_id, event_type, confidence, detected_at, status, reviewed_at, teacher_notes, action_taken)
LEFT JOIN teachers reviewer ON reviewer.email = CASE WHEN v.reviewed_at IS NULL THEN NULL ELSE '111@qq.com' END
ON CONFLICT (id) DO UPDATE SET
    student_id = EXCLUDED.student_id,
    session_id = EXCLUDED.session_id,
    event_type = EXCLUDED.event_type,
    confidence = EXCLUDED.confidence,
    detected_at = EXCLUDED.detected_at,
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
    ('d6000000-0000-4000-8000-000000000011'::uuid, 'd1000000-0000-4000-8000-000000000003'::uuid, 'COMPSCI 335 2026 Teaching Year', 'd2000000-0000-4000-8000-000000000013'::uuid, 'hmen498@aucklanduni.ac.nz', 'TEACHER_REPORTED', 'Minor injury', TIMESTAMPTZ '2026-09-01 14:46:00+12', 'Student reported a minor cut while packing equipment.', 'Applied a first-aid dressing.', 'No further follow-up requested.', NULL::uuid, TIMESTAMPTZ '2026-09-01 14:51:00+12')
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
-- attached to teststudent so the currently signed-in account has meaningful content immediately.
INSERT INTO progress_reports (
    id, student_id, course_offering_id, teacher_id, comment, created_at
)
SELECT v.id, s.id, co.id, t.id, v.comment, v.created_at
FROM (VALUES
    ('d7000000-0000-4000-8000-000000000001'::uuid, '000@qq.com', 'COMPSCI 335 2026 Teaching Year', 'hmen498@aucklanduni.ac.nz', 'You contributed a clear explanation during the group exercise. Keep connecting your implementation choices to the requirements.', TIMESTAMPTZ '2026-09-03 11:12:00+12'),
    ('d7000000-0000-4000-8000-000000000002'::uuid, '000@qq.com', 'COMPSCI 335 2026 Teaching Year', 'hmen498@aucklanduni.ac.nz', 'Good progress on the service integration task. Review the error-handling path before the next lab.', TIMESTAMPTZ '2026-09-01 15:16:00+12'),
    ('d7000000-0000-4000-8000-000000000003'::uuid, '000@qq.com', 'COMPSCI 335 2026 Teaching Year', 'hmen498@aucklanduni.ac.nz', 'Attendance and participation have been consistent this week. Your next step is to document the testing evidence more precisely.', TIMESTAMPTZ '2026-08-28 11:20:00+12'),
    ('d7000000-0000-4000-8000-000000000011'::uuid, 'ana.ngata.demo@auckland.ac.nz', 'INFOSYS 222 2026', '111@qq.com', 'Strong contribution to the case discussion. The process model was concise and easy for the group to follow.', TIMESTAMPTZ '2026-09-03 15:42:00+12'),
    ('d7000000-0000-4000-8000-000000000012'::uuid, 'ethan.smith.demo@auckland.ac.nz', 'INFOSYS 222 2026', '111@qq.com', 'Please revisit the stakeholder assumptions from today. Your analysis is on the right track but needs clearer evidence.', TIMESTAMPTZ '2026-09-01 11:38:00+12'),
    ('d7000000-0000-4000-8000-000000000013'::uuid, 'ziyi.zhang.demo@auckland.ac.nz', 'COMPSCI 335 2026 Teaching Year', 'hmen498@aucklanduni.ac.nz', 'Your debugging notes were thorough and helped the group isolate the issue quickly.', TIMESTAMPTZ '2026-09-03 11:25:00+12')
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
-- teststudent account meaningful student-portal content immediately.
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
    ('d8000000-0000-4000-8000-000000000001'::uuid, '000@qq.com', 'COMPSCI 335 2026 Teaching Year', 'hmen498@aucklanduni.ac.nz', 'PROJECT', 'Completed the service integration project', 'Delivered the end-to-end service integration milestone with documented test evidence.', 'A clear implementation with thoughtful error handling.', 30.00::numeric, DATE '2026-09-07', 'CONFIRMED', TIMESTAMPTZ '2026-09-07 13:20:00+12'),
    ('d8000000-0000-4000-8000-000000000002'::uuid, '000@qq.com', 'COMPSCI 335 2026 Teaching Year', 'hmen498@aucklanduni.ac.nz', 'MILESTONE', 'First full-stack workflow demonstrated', 'Connected the frontend workflow to the backend and demonstrated the complete user path.', NULL::text, NULL::numeric, DATE '2026-09-03', 'CONFIRMED', TIMESTAMPTZ '2026-09-03 15:40:00+12'),
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

COMMIT;
