package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

public record CreateHealthIncidentReportRequest(
        @NotNull UUID studentId,
        @NotNull UUID courseOfferingId,
        UUID sessionId,
        @NotBlank String incidentType,
        @NotNull Instant occurredAt,
        @NotBlank String description,
        String actionTaken,
        String teacherNotes
) {
}
