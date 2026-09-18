BEGIN;

-- Safe to run against an existing development database. This migration only adds the
-- Accomplishments feature and does not rewrite or remove any existing classroom data.
CREATE TABLE IF NOT EXISTS accomplishments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_offering_id UUID NOT NULL REFERENCES course_offerings(id),
    created_by_teacher_id UUID NOT NULL REFERENCES teachers(id),
    confirmed_by_teacher_id UUID REFERENCES teachers(id),
    revoked_by_teacher_id UUID REFERENCES teachers(id),
    category VARCHAR(24) NOT NULL
        CHECK (category IN ('PROJECT', 'MILESTONE', 'AWARD', 'IMPROVEMENT', 'LEADERSHIP', 'OTHER')),
    title VARCHAR(160) NOT NULL,
    description TEXT,
    student_note TEXT,
    points NUMERIC(8, 2) CHECK (points IS NULL OR points >= 0),
    achievement_date DATE NOT NULL,
    include_in_report BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'CONFIRMED', 'REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_accomplishments_student_id ON accomplishments(student_id);
CREATE INDEX IF NOT EXISTS idx_accomplishments_course_id ON accomplishments(course_offering_id);
CREATE INDEX IF NOT EXISTS idx_accomplishments_status ON accomplishments(status);
CREATE INDEX IF NOT EXISTS idx_accomplishments_date ON accomplishments(achievement_date);

COMMIT;
