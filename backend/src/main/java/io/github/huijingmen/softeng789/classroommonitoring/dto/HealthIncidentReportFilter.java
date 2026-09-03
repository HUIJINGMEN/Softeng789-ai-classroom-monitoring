package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.time.Instant;
import java.util.UUID;

public record HealthIncidentReportFilter(
        UUID courseOfferingId,
        UUID studentId,
        String source,
        String incidentType,
        Instant dateFrom,
        Instant dateTo
) {
    public static final HealthIncidentReportFilter NONE =
            new HealthIncidentReportFilter(null, null, null, null, null, null);
}
