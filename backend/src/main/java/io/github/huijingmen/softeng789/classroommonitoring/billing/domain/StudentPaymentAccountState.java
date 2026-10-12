package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

/**
 * A student-level read state for the administration directory. It is derived from invoices,
 * transactions and pending evidence; it is never persisted as a second source of truth.
 */
public enum StudentPaymentAccountState {
    PAYMENT_REVIEW,
    OVERDUE,
    DRAFT,
    NEEDS_INVOICE,
    PARTIALLY_PAID,
    PAYMENT_DUE,
    PAID,
    NO_PAYMENT_DUE
}
