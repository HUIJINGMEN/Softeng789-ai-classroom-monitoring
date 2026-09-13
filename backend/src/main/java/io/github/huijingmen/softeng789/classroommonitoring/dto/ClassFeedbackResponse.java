package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.time.Instant;
import java.util.UUID;

public record ClassFeedbackResponse(
        UUID id,
        UUID courseOfferingId,
        String classLabel,
        UUID teacherId,
        String teacherName,
        String comment,
        Instant createdAt
) {
}
