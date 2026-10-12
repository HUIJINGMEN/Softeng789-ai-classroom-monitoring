package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

/**
 * Financial lifecycle for a purchased block of lessons. This is intentionally separate from
 * {@link LessonCreditStatus}: an invoice can exist before it grants any usable lesson rights.
 */
public enum SessionPackageStatus {
    PENDING_PAYMENT,
    ACTIVE,
    PAUSED,
    CANCELLED
}
