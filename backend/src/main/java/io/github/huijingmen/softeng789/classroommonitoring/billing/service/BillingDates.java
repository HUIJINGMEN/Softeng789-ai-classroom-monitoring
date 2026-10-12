package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import java.time.LocalDate;
import java.time.ZoneId;

/** Single source of truth for date-only billing rules. */
final class BillingDates {
    static final ZoneId BUSINESS_ZONE = ZoneId.of("Pacific/Auckland");

    private BillingDates() {
    }

    static LocalDate today() {
        return LocalDate.now(BUSINESS_ZONE);
    }

    static int currentYear() {
        return today().getYear();
    }
}
