package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.time.Instant;
import java.util.UUID;

public record ProgressReportResponse(
        UUID id,
        UUID studentId,
        String studentName,
        UUID courseOfferingId,
        String classLabel,
        UUID teacherId,
        String teacherName,
        String comment,
        String photoUrl,
        Instant createdAt
) {
}
