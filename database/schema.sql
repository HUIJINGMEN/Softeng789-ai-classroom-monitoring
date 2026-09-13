CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_number VARCHAR(32) NOT NULL UNIQUE,
    university_email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    course VARCHAR(120) NOT NULL,
    seat VARCHAR(40) NOT NULL,
    programme VARCHAR(160) NOT NULL,
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    face_enrollment_status VARCHAR(30) NOT NULL DEFAULT 'NOT_ENROLLED' CHECK (
        face_enrollment_status IN ('NOT_ENROLLED', 'PHOTO_CAPTURED', 'FAILED')
    ),
    level VARCHAR(20) NOT NULL DEFAULT 'LEVEL_1' CHECK (
        level IN ('LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4')
    ),
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(120) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL
);

CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_number VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    password_hash VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS campuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE RESTRICT,
    code VARCHAR(120) NOT NULL,
    name VARCHAR(160) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT rooms_unique_campus_code UNIQUE (campus_id, code)
);

CREATE TABLE IF NOT EXISTS course_offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    offering_code VARCHAR(160) NOT NULL UNIQUE,
    academic_term VARCHAR(80) NOT NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DROPPED')),
    CONSTRAINT course_enrollments_unique_student_course UNIQUE (student_id, course_id)
);

CREATE TABLE IF NOT EXISTS face_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    image_path VARCHAR(500) NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('NOT_ENROLLED', 'PHOTO_CAPTURED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classroom_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_name VARCHAR(120) NOT NULL,
    room VARCHAR(120) NOT NULL,
    course_offering_id UUID REFERENCES course_offerings(id) ON DELETE SET NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    session_date DATE NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED' CHECK (
        status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED')
    ),
    CONSTRAINT classroom_sessions_time_check CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENT', 'LATE', 'ABSENT', 'UNKNOWN')),
    source VARCHAR(20) NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'AI')),
    CONSTRAINT attendance_records_unique_student_session UNIQUE (student_id, session_id)
);

CREATE TABLE IF NOT EXISTS behaviour_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    session_id UUID NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(120) NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    timestamp TIMESTAMPTZ NOT NULL,
    review_status VARCHAR(30) NOT NULL CHECK (
        review_status IN ('PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'CORRECTED')
    ),
    teacher_note TEXT
);

ALTER TABLE IF EXISTS classroom_sessions
    ADD COLUMN IF NOT EXISTS course_offering_id UUID,
    ADD COLUMN IF NOT EXISTS room_id UUID,
    ADD COLUMN IF NOT EXISTS teacher_id UUID;

ALTER TABLE IF EXISTS students
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

ALTER TABLE IF EXISTS teachers
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Optimistic-locking version, so two concurrent self-registrations racing to claim the same
-- passwordless student/teacher record can be told apart safely instead of one silently
-- overwriting the other's password.
ALTER TABLE IF EXISTS students
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS teachers
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

-- Admins are just teachers with an elevated role, not a separate table — they share every other
-- field, and it lets an existing admin "promote" a teacher later by flipping one column.
ALTER TABLE IF EXISTS teachers
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'TEACHER'
    CHECK (role IN ('TEACHER', 'ADMIN'));

CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_behaviour_events_student_id ON behaviour_events(student_id);
CREATE INDEX IF NOT EXISTS idx_behaviour_events_session_id ON behaviour_events(session_id);
CREATE INDEX IF NOT EXISTS idx_behaviour_events_review_status ON behaviour_events(review_status);
CREATE INDEX IF NOT EXISTS idx_face_enrollments_student_id ON face_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_course_offerings_course_id ON course_offerings(course_id);
CREATE INDEX IF NOT EXISTS idx_course_offerings_teacher_id ON course_offerings(teacher_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_student_id ON course_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_course_offering_id ON classroom_sessions(course_offering_id);
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_room_id ON classroom_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_teacher_id ON classroom_sessions(teacher_id);

INSERT INTO courses (code, name)
SELECT DISTINCT UPPER(TRIM(course)), UPPER(TRIM(course))
FROM students
WHERE course IS NOT NULL AND TRIM(course) <> ''
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name)
SELECT DISTINCT UPPER(TRIM(course_name)), UPPER(TRIM(course_name))
FROM classroom_sessions
WHERE course_name IS NOT NULL AND TRIM(course_name) <> ''
ON CONFLICT (code) DO NOTHING;

INSERT INTO teachers (staff_number, email, name)
VALUES ('UNASSIGNED', 'unassigned.teacher@auckland.ac.nz', 'Unassigned Teacher')
ON CONFLICT (email) DO NOTHING;

-- Bootstrap admin: passwordless, like the placeholder above. The first real administrator claims
-- it by registering through the normal teacher sign-up form with this exact staff number/email,
-- which sets a password without changing its role. There is no public admin self-registration.
INSERT INTO teachers (staff_number, email, name, role)
VALUES ('ADMIN-0001', 'admin@auckland.ac.nz', 'System Admin', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

INSERT INTO rooms (code, name, capacity)
SELECT DISTINCT TRIM(room), TRIM(room), 0
FROM classroom_sessions
WHERE room IS NOT NULL AND TRIM(room) <> ''
ON CONFLICT (code) DO NOTHING;

INSERT INTO course_offerings (course_id, offering_code, academic_term, teacher_id)
SELECT DISTINCT
    courses.id,
    courses.code || ' ' || EXTRACT(YEAR FROM classroom_sessions.session_date)::INT,
    EXTRACT(YEAR FROM classroom_sessions.session_date)::INT || ' Teaching Year',
    teachers.id
FROM classroom_sessions
JOIN courses ON courses.code = UPPER(TRIM(classroom_sessions.course_name))
CROSS JOIN teachers
WHERE classroom_sessions.course_name IS NOT NULL
  AND TRIM(classroom_sessions.course_name) <> ''
  AND teachers.email = 'unassigned.teacher@auckland.ac.nz'
ON CONFLICT (offering_code) DO NOTHING;

UPDATE classroom_sessions
SET room_id = rooms.id
FROM rooms
WHERE classroom_sessions.room_id IS NULL
  AND rooms.code = TRIM(classroom_sessions.room);

UPDATE classroom_sessions
SET teacher_id = teachers.id
FROM teachers
WHERE classroom_sessions.teacher_id IS NULL
  AND teachers.email = 'unassigned.teacher@auckland.ac.nz';

UPDATE classroom_sessions
SET course_offering_id = course_offerings.id
FROM courses, course_offerings
WHERE classroom_sessions.course_offering_id IS NULL
  AND courses.code = UPPER(TRIM(classroom_sessions.course_name))
  AND course_offerings.course_id = courses.id
  AND course_offerings.offering_code = courses.code || ' ' || EXTRACT(YEAR FROM classroom_sessions.session_date)::INT;

INSERT INTO course_enrollments (student_id, course_id, status)
SELECT students.id, courses.id, 'ACTIVE'
FROM students
JOIN courses ON courses.code = UPPER(TRIM(students.course))
WHERE students.course IS NOT NULL AND TRIM(students.course) <> ''
ON CONFLICT (student_id, course_id) DO NOTHING;

-- "Class" = CourseOffering (a course taught by one or more teachers in a given year). A class can
-- now have several teachers, so the old single course_offerings.teacher_id column becomes a
-- many-to-many join table instead.
ALTER TABLE IF EXISTS course_offerings
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'ARCHIVED'));

CREATE TABLE IF NOT EXISTS course_offering_teachers (
    course_offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    PRIMARY KEY (course_offering_id, teacher_id)
);

-- Carry over whatever single teacher an offering already had before this table existed.
INSERT INTO course_offering_teachers (course_offering_id, teacher_id)
SELECT id, teacher_id FROM course_offerings WHERE teacher_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Course enrolment now points at a specific class (course_offering) instead of just a course, so
-- "the same course taught by two different teachers/years" can be told apart. Self-registration
-- and the teacher-creation form no longer write to this table at all going forward — only Admin's
-- class management does — but existing enrolments need a one-time migration so nobody silently
-- disappears from every roster.
ALTER TABLE IF EXISTS course_enrollments
    ADD COLUMN IF NOT EXISTS course_offering_id UUID REFERENCES course_offerings(id) ON DELETE CASCADE;

-- Make sure every course an existing enrolment references has at least one offering to migrate into.
INSERT INTO course_offerings (course_id, offering_code, academic_term, status)
SELECT DISTINCT
    course_enrollments.course_id,
    courses.code || ' ' || EXTRACT(YEAR FROM NOW())::INT,
    EXTRACT(YEAR FROM NOW())::INT || ' Teaching Year',
    'ACTIVE'
FROM course_enrollments
JOIN courses ON courses.id = course_enrollments.course_id
WHERE NOT EXISTS (
    SELECT 1 FROM course_offerings existing WHERE existing.course_id = course_enrollments.course_id
)
ON CONFLICT (offering_code) DO NOTHING;

-- Every class needs at least one teacher — anything still teacherless (including offerings just
-- created above) falls back to the same "Unassigned Teacher" placeholder used elsewhere.
INSERT INTO course_offering_teachers (course_offering_id, teacher_id)
SELECT course_offerings.id, teachers.id
FROM course_offerings
CROSS JOIN teachers
WHERE teachers.email = 'unassigned.teacher@auckland.ac.nz'
  AND NOT EXISTS (
      SELECT 1 FROM course_offering_teachers existing
      WHERE existing.course_offering_id = course_offerings.id
  )
ON CONFLICT DO NOTHING;

-- Point each existing enrolment at one concrete offering of its course (picked deterministically
-- if a course happens to have more than one).
UPDATE course_enrollments
SET course_offering_id = matched.offering_id
FROM (
    SELECT DISTINCT ON (course_enrollments.id)
        course_enrollments.id AS enrollment_id,
        course_offerings.id AS offering_id
    FROM course_enrollments
    JOIN course_offerings ON course_offerings.course_id = course_enrollments.course_id
    ORDER BY course_enrollments.id, course_offerings.offering_code
) AS matched
WHERE course_enrollments.id = matched.enrollment_id
  AND course_enrollments.course_offering_id IS NULL;

ALTER TABLE IF EXISTS course_enrollments
    ALTER COLUMN course_offering_id SET NOT NULL;

-- Dropping course_id also drops the old (student_id, course_id) unique constraint and its index,
-- since both are defined on that column.
ALTER TABLE IF EXISTS course_enrollments
    DROP COLUMN IF EXISTS course_id;

ALTER TABLE IF EXISTS course_offerings
    DROP COLUMN IF EXISTS teacher_id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_enrollments_unique_student_offering'
    ) THEN
        ALTER TABLE course_enrollments
            ADD CONSTRAINT course_enrollments_unique_student_offering UNIQUE (student_id, course_offering_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_course_offering_teachers_teacher_id ON course_offering_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_offering_id ON course_enrollments(course_offering_id);

-- Withdrawing a student from a class is a status change, not a delete — attendance/session history
-- tied to their old enrolment must survive. Renamed DROPPED -> WITHDRAWN to match the terminology
-- used everywhere else in this feature (Admin-facing "withdraw"/"transfer" actions).
ALTER TABLE IF EXISTS course_enrollments
    ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;

DO $$
DECLARE
    status_check_name text;
BEGIN
    SELECT conname INTO status_check_name
    FROM pg_constraint
    WHERE conrelid = 'course_enrollments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%DROPPED%';

    IF status_check_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE course_enrollments DROP CONSTRAINT %I', status_check_name);
    END IF;

    UPDATE course_enrollments SET status = 'WITHDRAWN' WHERE status = 'DROPPED';

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_enrollments_status_check'
    ) THEN
        ALTER TABLE course_enrollments
            ADD CONSTRAINT course_enrollments_status_check CHECK (status IN ('ACTIVE', 'WITHDRAWN'));
    END IF;
END $$;

-- Self-registration now requires Admin review before it counts as a real enrolment — a class an
-- unreviewed student "picked" sits as PENDING (invisible to rosters/attendance/counts, all of
-- which already filter by status) until an Admin approves the account, at which point it becomes
-- ACTIVE. Staff-created enrolments (AdminClassService) are unaffected — they go straight to ACTIVE.
DO $$
DECLARE
    status_check_name text;
BEGIN
    SELECT conname INTO status_check_name
    FROM pg_constraint
    WHERE conrelid = 'course_enrollments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%ACTIVE%WITHDRAWN%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%PENDING%';

    IF status_check_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE course_enrollments DROP CONSTRAINT %I', status_check_name);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_enrollments_status_check3'
    ) THEN
        ALTER TABLE course_enrollments
            ADD CONSTRAINT course_enrollments_status_check3 CHECK (status IN ('PENDING', 'ACTIVE', 'WITHDRAWN'));
    END IF;
END $$;

-- Every existing student predates this workflow and is already a known-good account (self-claimed
-- or staff-provisioned) — only a brand-new self-registration going forward starts PENDING.
ALTER TABLE IF EXISTS students
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED'
    CHECK (approval_status IN ('PENDING', 'APPROVED'));

-- A pending registration needs a way to end besides Approve — otherwise a rejected sign-up (spam,
-- duplicate, bad data) just sits in the review queue forever. REJECTED is terminal: the account
-- keeps existing (so the same email/student number can't be used to silently re-register) but
-- StudentService.listStudents() excludes it, same as PENDING, so it never shows up as a real
-- student anywhere in rosters, counts or reports.
DO $$
DECLARE
    status_check_name text;
BEGIN
    SELECT conname INTO status_check_name
    FROM pg_constraint
    WHERE conrelid = 'students'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%approval_status%APPROVED%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%REJECTED%';

    IF status_check_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE students DROP CONSTRAINT %I', status_check_name);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'students_approval_status_check2'
    ) THEN
        ALTER TABLE students
            ADD CONSTRAINT students_approval_status_check2
            CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
    END IF;
END $$;

-- A session that turns out to be wrong (wrong room, duplicate, no longer happening) had no way to
-- leave the schedule — the only states were SCHEDULED/ACTIVE/COMPLETED, none of which mean
-- "cancelled". CANCELLED is a soft, terminal state, same idea as WITHDRAWN enrolments and
-- REJECTED registrations: the row and any attendance already recorded against it stay exactly as
-- they are, it's just no longer treated as a session that is or will be running.
DO $$
DECLARE
    status_check_name text;
BEGIN
    SELECT conname INTO status_check_name
    FROM pg_constraint
    WHERE conrelid = 'classroom_sessions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%SCHEDULED%ACTIVE%COMPLETED%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%CANCELLED%';

    IF status_check_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE classroom_sessions DROP CONSTRAINT %I', status_check_name);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'classroom_sessions_status_check2'
    ) THEN
        ALTER TABLE classroom_sessions
            ADD CONSTRAINT classroom_sessions_status_check2
            CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'));
    END IF;
END $$;

-- Self-registration never collects a programme, so it used to write the literal string
-- "Unassigned" — which reads like a real (if odd) programme name in the UI rather than "no value
-- given yet". Normalise old rows and stop defaulting new ones to that placeholder; the frontend
-- shows "Not provided" for an empty programme.
ALTER TABLE IF EXISTS students ALTER COLUMN programme SET DEFAULT '';
UPDATE students SET programme = '' WHERE programme IN ('Unassigned', 'Unassigned programme');

-- A staff account (teacher or admin) had no way to be taken out of service — deleting the row
-- outright isn't safe, since classroom_sessions.teacher_id has no foreign key (it would silently
-- dangle) and course_offering_teachers cascades on delete (it would erase who taught a class
-- historically). DEACTIVATED is the same soft-terminal idea as WITHDRAWN enrolments, CANCELLED
-- sessions and ARCHIVED classes: the row and every historical relationship to it stay exactly as
-- they are; it's just no longer usable for login or new assignments.
ALTER TABLE IF EXISTS teachers ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'teachers_status_check'
    ) THEN
        ALTER TABLE teachers
            ADD CONSTRAINT teachers_status_check
            CHECK (status IN ('ACTIVE', 'DEACTIVATED'));
    END IF;
END $$;

-- Same soft-terminal pattern as teachers.status, for a whole student account: withdrawing a
-- student needs to survive without losing their attendance history, past enrolments or face
-- enrolment data — only course_enrollments had a per-class WITHDRAWN state until now, nothing
-- covered "this whole student has left".
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'students_status_check2'
    ) THEN
        ALTER TABLE students
            ADD CONSTRAINT students_status_check2
            CHECK (status IN ('ACTIVE', 'WITHDRAWN'));
    END IF;
END $$;

-- A teacher-reported health incident (nosebleed, fall, etc.) — deliberately its own table and
-- workflow rather than reusing behaviour_events/candidate events: a health alert isn't an AI
-- observation awaiting confirm/reject, it's a manual report awaiting follow-up (open/resolved).
CREATE TABLE IF NOT EXISTS health_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id UUID REFERENCES classroom_sessions(id) ON DELETE SET NULL,
    reported_by_teacher_id UUID NOT NULL REFERENCES teachers(id),
    type VARCHAR(60) NOT NULL,
    note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by_teacher_id UUID REFERENCES teachers(id)
);

CREATE INDEX IF NOT EXISTS idx_health_alerts_student_id ON health_alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_health_alerts_status ON health_alerts(status);

-- Health Alerts are being redefined: previously a teacher-manual report (OPEN/RESOLVED); now
-- exclusively the AI-detected "awaiting review" candidate half of a new two-entity model —
-- HealthAlert (this table, AI candidate only) + HealthIncidentReport (the formal record, either
-- confirmed from an alert or created directly by a teacher). The old manual-report use case moves
-- to health_incident_reports with source='TEACHER_REPORTED' and health_alert_id=NULL.
CREATE TABLE IF NOT EXISTS health_incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_offering_id UUID NOT NULL REFERENCES course_offerings(id),
    session_id UUID REFERENCES classroom_sessions(id) ON DELETE SET NULL,
    teacher_id UUID NOT NULL REFERENCES teachers(id),
    source VARCHAR(30) NOT NULL CHECK (source IN ('AI_DETECTED', 'TEACHER_REPORTED')),
    incident_type VARCHAR(60) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    action_taken TEXT,
    teacher_notes TEXT,
    health_alert_id UUID REFERENCES health_alerts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Carry over any pre-existing manual reports (there is no equivalent for them in the new
-- health_alerts shape below, since that table no longer represents manual reports at all).
-- Falls back to the offering derived from the alert's session where one exists; an old alert with
-- no session and therefore no derivable class is skipped rather than guessed at.
INSERT INTO health_incident_reports
    (id, student_id, course_offering_id, session_id, teacher_id, source, incident_type,
     occurred_at, description, teacher_notes, created_at)
SELECT
    ha.id, ha.student_id, cs.course_offering_id, ha.session_id, ha.reported_by_teacher_id,
    'TEACHER_REPORTED', ha.type, ha.created_at, ha.type, ha.note, ha.created_at
FROM health_alerts ha
LEFT JOIN classroom_sessions cs ON cs.id = ha.session_id
WHERE cs.course_offering_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Nothing left in health_alerts fits the new AI-candidate shape (it just got migrated above), so
-- the table can be safely reshaped from here without a lossy column-by-column remap.
DELETE FROM health_alerts;

ALTER TABLE IF EXISTS health_alerts
    ADD COLUMN IF NOT EXISTS event_type VARCHAR(60),
    ADD COLUMN IF NOT EXISTS confidence NUMERIC(4, 3),
    ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'AI_SERVICE',
    ADD COLUMN IF NOT EXISTS evidence_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS reviewed_by_teacher_id UUID REFERENCES teachers(id),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS teacher_notes TEXT,
    ADD COLUMN IF NOT EXISTS action_taken TEXT;

ALTER TABLE IF EXISTS health_alerts
    ALTER COLUMN event_type SET NOT NULL,
    ALTER COLUMN detected_at SET NOT NULL,
    ALTER COLUMN session_id SET NOT NULL;

ALTER TABLE IF EXISTS health_alerts
    DROP COLUMN IF EXISTS type,
    DROP COLUMN IF EXISTS note,
    DROP COLUMN IF EXISTS reported_by_teacher_id,
    DROP COLUMN IF EXISTS resolved_at,
    DROP COLUMN IF EXISTS resolved_by_teacher_id;

DO $$
DECLARE
    status_check_name text;
BEGIN
    SELECT conname INTO status_check_name
    FROM pg_constraint
    WHERE conrelid = 'health_alerts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%OPEN%RESOLVED%';

    IF status_check_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE health_alerts DROP CONSTRAINT %I', status_check_name);
    END IF;

    ALTER TABLE health_alerts ALTER COLUMN status SET DEFAULT 'AWAITING_REVIEW';
    UPDATE health_alerts SET status = 'AWAITING_REVIEW';

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'health_alerts_status_check2'
    ) THEN
        ALTER TABLE health_alerts
            ADD CONSTRAINT health_alerts_status_check2
            CHECK (status IN ('AWAITING_REVIEW', 'CONFIRMED', 'DISMISSED'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'health_alerts_confidence_check'
    ) THEN
        ALTER TABLE health_alerts
            ADD CONSTRAINT health_alerts_confidence_check
            CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_health_alerts_session_id ON health_alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_health_incident_reports_student_id ON health_incident_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_health_incident_reports_course_offering_id ON health_incident_reports(course_offering_id);
CREATE INDEX IF NOT EXISTS idx_health_incident_reports_health_alert_id ON health_incident_reports(health_alert_id);

-- Teacher-authored student progress notes. The web console creates text feedback and the companion
-- mobile app can additionally attach photo evidence; both remain visible in the student's history.
CREATE TABLE IF NOT EXISTS progress_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_offering_id UUID NOT NULL REFERENCES course_offerings(id),
    teacher_id UUID NOT NULL REFERENCES teachers(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_reports_student_id ON progress_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_reports_course_offering_id ON progress_reports(course_offering_id);

-- Whole-class feedback is deliberately separate from student progress reports: it contributes to
-- class and institution summaries but never appears in an individual student's portal history.
CREATE TABLE IF NOT EXISTS class_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_offering_id UUID NOT NULL REFERENCES course_offerings(id),
    teacher_id UUID NOT NULL REFERENCES teachers(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_feedback_course_offering_id ON class_feedback(course_offering_id);
CREATE INDEX IF NOT EXISTS idx_class_feedback_teacher_id ON class_feedback(teacher_id);

-- Reviewed AI synthesis used by exported reports and the student portal. Source Progress Reports
-- remain intact for audit/regeneration, while this table freezes exactly what a teacher approved
-- for a student, class and reporting period.
CREATE TABLE IF NOT EXISTS feedback_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_offering_id UUID NOT NULL REFERENCES course_offerings(id),
    created_by_teacher_id UUID NOT NULL REFERENCES teachers(id),
    reviewed_by_teacher_id UUID REFERENCES teachers(id),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    summary TEXT NOT NULL,
    strengths TEXT NOT NULL,
    next_steps TEXT NOT NULL,
    source_feedback_count INTEGER NOT NULL CHECK (source_feedback_count > 0),
    source_fingerprint VARCHAR(64) NOT NULL,
    provider VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'REVIEWED', 'SUPERSEDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    emailed_at TIMESTAMPTZ,
    CHECK (date_to >= date_from)
);

CREATE INDEX IF NOT EXISTS idx_feedback_summaries_student_id ON feedback_summaries(student_id);
CREATE INDEX IF NOT EXISTS idx_feedback_summaries_course_id ON feedback_summaries(course_offering_id);
CREATE INDEX IF NOT EXISTS idx_feedback_summaries_status ON feedback_summaries(status);
