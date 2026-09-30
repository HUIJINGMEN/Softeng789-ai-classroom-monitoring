-- AI verification is a distinct state from merely receiving photos. Only VERIFIED students may
-- create a self-registration request that enters the Admin approval queue.
ALTER TABLE students
    DROP CONSTRAINT IF EXISTS students_face_enrollment_status_check;
ALTER TABLE students
    ADD CONSTRAINT students_face_enrollment_status_check
        CHECK (face_enrollment_status IN ('NOT_ENROLLED', 'PHOTO_CAPTURED', 'VERIFIED', 'FAILED'));

ALTER TABLE face_enrollments
    DROP CONSTRAINT IF EXISTS face_enrollments_status_check;
ALTER TABLE face_enrollments
    ADD CONSTRAINT face_enrollments_status_check
        CHECK (status IN ('NOT_ENROLLED', 'PHOTO_CAPTURED', 'VERIFIED', 'FAILED'));
