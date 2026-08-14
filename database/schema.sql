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
    name VARCHAR(160) NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(120) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 0
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
