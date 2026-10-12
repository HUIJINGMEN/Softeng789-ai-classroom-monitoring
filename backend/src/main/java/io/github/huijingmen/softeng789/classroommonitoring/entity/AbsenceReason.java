package io.github.huijingmen.softeng789.classroommonitoring.entity;

/**
 * Why an attendance record was marked absent. This belongs to attendance rather than billing:
 * every student can have an explained absence, even when their course has no per-lesson balance.
 */
public enum AbsenceReason {
    ILLNESS,
    ADVANCE_NOTICE,
    NO_NOTICE,
    SCHOOL_CANCELLED,
    OTHER
}
