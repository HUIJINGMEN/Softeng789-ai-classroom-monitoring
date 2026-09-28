package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

public enum InvoiceStatus {
    PENDING,
    PARTIALLY_PAID,
    PAID,
    OVERDUE,
    CANCELLED;

    public boolean isOpen() {
        return this == PENDING || this == PARTIALLY_PAID || this == OVERDUE;
    }

    public boolean canBecomeOverdue() {
        return this == PENDING || this == PARTIALLY_PAID;
    }
}
