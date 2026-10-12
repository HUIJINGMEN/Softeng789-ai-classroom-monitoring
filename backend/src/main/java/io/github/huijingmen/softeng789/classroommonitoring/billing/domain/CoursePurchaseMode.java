package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

/** What access the student receives. Payment timing is deliberately modelled elsewhere. */
public enum CoursePurchaseMode {
    COURSE_ENROLMENT,
    LESSON_PACKAGE,
    MEMBERSHIP,
    PAY_PER_LESSON
}
