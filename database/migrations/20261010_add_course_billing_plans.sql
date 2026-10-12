-- Separate what a class sells from how an invoice is paid. Existing classes default to a full
-- course enrolment; offerings with lesson packages retain their current package behaviour.
ALTER TABLE course_offerings
    ADD COLUMN IF NOT EXISTS purchase_mode VARCHAR(32) NOT NULL DEFAULT 'COURSE_ENROLMENT',
    ADD COLUMN IF NOT EXISTS default_price NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS default_session_count INTEGER,
    ADD COLUMN IF NOT EXISTS package_validity_days INTEGER,
    ADD COLUMN IF NOT EXISTS absence_policy VARCHAR(32),
    ADD COLUMN IF NOT EXISTS membership_interval VARCHAR(24),
    ADD COLUMN IF NOT EXISTS sessions_per_period INTEGER,
    ADD COLUMN IF NOT EXISTS pay_per_lesson_trigger VARCHAR(24);

ALTER TABLE course_offerings DROP CONSTRAINT IF EXISTS course_offerings_purchase_mode_check;
ALTER TABLE course_offerings ADD CONSTRAINT course_offerings_purchase_mode_check CHECK (
    purchase_mode IN ('COURSE_ENROLMENT', 'LESSON_PACKAGE', 'MEMBERSHIP', 'PAY_PER_LESSON')
);
ALTER TABLE course_offerings DROP CONSTRAINT IF EXISTS course_offerings_default_price_check;
ALTER TABLE course_offerings ADD CONSTRAINT course_offerings_default_price_check
    CHECK (default_price IS NULL OR default_price > 0);
ALTER TABLE course_offerings DROP CONSTRAINT IF EXISTS course_offerings_default_session_count_check;
ALTER TABLE course_offerings ADD CONSTRAINT course_offerings_default_session_count_check
    CHECK (default_session_count IS NULL OR default_session_count BETWEEN 1 AND 500);
ALTER TABLE course_offerings DROP CONSTRAINT IF EXISTS course_offerings_validity_days_check;
ALTER TABLE course_offerings ADD CONSTRAINT course_offerings_validity_days_check
    CHECK (package_validity_days IS NULL OR package_validity_days BETWEEN 1 AND 3650);
ALTER TABLE course_offerings DROP CONSTRAINT IF EXISTS course_offerings_absence_policy_check;
ALTER TABLE course_offerings ADD CONSTRAINT course_offerings_absence_policy_check
    CHECK (absence_policy IS NULL OR absence_policy IN ('CONSUME_UNEXCUSED', 'ATTENDANCE_ONLY'));
ALTER TABLE course_offerings DROP CONSTRAINT IF EXISTS course_offerings_membership_interval_check;
ALTER TABLE course_offerings ADD CONSTRAINT course_offerings_membership_interval_check
    CHECK (membership_interval IS NULL OR membership_interval IN ('WEEKLY', 'MONTHLY', 'TERM', 'ANNUAL'));
ALTER TABLE course_offerings DROP CONSTRAINT IF EXISTS course_offerings_sessions_per_period_check;
ALTER TABLE course_offerings ADD CONSTRAINT course_offerings_sessions_per_period_check
    CHECK (sessions_per_period IS NULL OR sessions_per_period BETWEEN 1 AND 500);
ALTER TABLE course_offerings DROP CONSTRAINT IF EXISTS course_offerings_pay_trigger_check;
ALTER TABLE course_offerings ADD CONSTRAINT course_offerings_pay_trigger_check
    CHECK (pay_per_lesson_trigger IS NULL OR pay_per_lesson_trigger IN ('BOOKING', 'ATTENDANCE'));

UPDATE course_offerings offering
SET purchase_mode = 'LESSON_PACKAGE',
    default_session_count = COALESCE((
        SELECT MAX(package.purchased_sessions)
        FROM student_session_packages package
        WHERE package.course_offering_id = offering.id
    ), 10),
    absence_policy = COALESCE((
        SELECT package.absence_policy
        FROM student_session_packages package
        WHERE package.course_offering_id = offering.id
        ORDER BY package.created_at DESC
        LIMIT 1
    ), 'CONSUME_UNEXCUSED')
WHERE EXISTS (
    SELECT 1 FROM student_session_packages package WHERE package.course_offering_id = offering.id
);

CREATE TABLE IF NOT EXISTS student_learning_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_offering_id UUID NOT NULL REFERENCES course_offerings(id),
    classroom_session_id UUID REFERENCES classroom_sessions(id) ON DELETE SET NULL,
    purchase_mode VARCHAR(32) NOT NULL CHECK (
        purchase_mode IN ('COURSE_ENROLMENT', 'LESSON_PACKAGE', 'MEMBERSHIP', 'PAY_PER_LESSON')
    ),
    status VARCHAR(32) NOT NULL CHECK (
        status IN ('PENDING_PAYMENT', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED')
    ),
    valid_from DATE,
    valid_to DATE,
    session_allowance INTEGER CHECK (session_allowance IS NULL OR session_allowance > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from)
);

ALTER TABLE student_invoices ADD COLUMN IF NOT EXISTS entitlement_id UUID;
ALTER TABLE student_invoices DROP CONSTRAINT IF EXISTS student_invoices_entitlement_id_fkey;
ALTER TABLE student_invoices ADD CONSTRAINT student_invoices_entitlement_id_fkey
    FOREIGN KEY (entitlement_id) REFERENCES student_learning_entitlements(id) ON DELETE SET NULL;

-- Preserve every existing package as a first-class entitlement and link its original invoice.
INSERT INTO student_learning_entitlements (
    student_id, course_offering_id, purchase_mode, status, valid_from, valid_to,
    session_allowance, created_at, updated_at
)
SELECT package.student_id,
       package.course_offering_id,
       'LESSON_PACKAGE',
       CASE package.status
           WHEN 'ACTIVE' THEN 'ACTIVE'
           WHEN 'CANCELLED' THEN 'CANCELLED'
           ELSE 'PENDING_PAYMENT'
       END,
       package.service_from,
       package.service_to,
       package.purchased_sessions,
       package.created_at,
       package.created_at
FROM student_session_packages package
WHERE NOT EXISTS (
    SELECT 1 FROM student_invoices invoice WHERE invoice.id = package.invoice_id
      AND invoice.entitlement_id IS NOT NULL
);

UPDATE student_invoices invoice
SET entitlement_id = entitlement.id
FROM student_session_packages package,
     LATERAL (
         SELECT candidate.id
         FROM student_learning_entitlements candidate
         WHERE candidate.student_id = package.student_id
           AND candidate.course_offering_id = package.course_offering_id
           AND candidate.purchase_mode = 'LESSON_PACKAGE'
           AND candidate.created_at = package.created_at
         ORDER BY candidate.id
         LIMIT 1
     ) entitlement
WHERE package.invoice_id = invoice.id
  AND invoice.entitlement_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_learning_entitlements_student_offering
    ON student_learning_entitlements(student_id, course_offering_id, purchase_mode, status);
CREATE INDEX IF NOT EXISTS idx_learning_entitlements_session
    ON student_learning_entitlements(student_id, classroom_session_id)
    WHERE classroom_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_invoices_entitlement
    ON student_invoices(entitlement_id)
    WHERE entitlement_id IS NOT NULL;
