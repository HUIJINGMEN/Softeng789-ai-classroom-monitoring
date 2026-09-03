package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.time.Instant;
import java.util.UUID;

public record HealthIncidentReportResponse(
        UUID id,
        UUID studentId,
        String studentName,
        UUID courseOfferingId,
        String classLabel,
        UUID sessionId,
        String sessionLabel,
        UUID teacherId,
        String teacherName,
        String source,
        String incidentType,
        Instant occurredAt,
        String description,
        String actionTaken,
        String teacherNotes,
        UUID healthAlertId,
        Instant createdAt
) {
}
