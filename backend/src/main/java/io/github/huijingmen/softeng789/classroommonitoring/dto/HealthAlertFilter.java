package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.time.Instant;
import java.util.UUID;

/** Every field optional — used by Admin's filter toolbar; a Teacher's own view passes all nulls
 *  (role-based scoping already happened before these filters are applied). */
public record HealthAlertFilter(
        UUID courseOfferingId,
        UUID studentId,
        String status,
        String eventType,
        String source,
        Instant dateFrom,
        Instant dateTo
) {
    public static final HealthAlertFilter NONE =
            new HealthAlertFilter(null, null, null, null, null, null, null);
}
