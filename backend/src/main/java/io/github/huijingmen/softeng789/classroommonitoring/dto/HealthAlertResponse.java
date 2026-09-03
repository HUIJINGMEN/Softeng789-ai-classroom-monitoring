package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record HealthAlertResponse(
        UUID id,
        UUID studentId,
        String studentName,
        UUID sessionId,
        String classLabel,
        String room,
        Instant detectedAt,
        String eventType,
        BigDecimal confidence,
        String source,
        String status,
        String evidenceUrl,
        UUID reviewedByTeacherId,
        String reviewedByTeacherName,
        Instant reviewedAt,
        String teacherNotes,
        String actionTaken,
        Instant createdAt
) {
}
