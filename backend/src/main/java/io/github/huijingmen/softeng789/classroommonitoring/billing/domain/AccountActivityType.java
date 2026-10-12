package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

public enum AccountActivityType {
    PACKAGE_PAUSED,
    PACKAGE_RESUMED,
    PACKAGE_EXTENDED,
    PACKAGE_TRANSFERRED,
    PACKAGE_CANCELLED,
    CREDIT_ADJUSTMENT,
    REFUND_ISSUED,
    PAYMENT_REVERSED
}
