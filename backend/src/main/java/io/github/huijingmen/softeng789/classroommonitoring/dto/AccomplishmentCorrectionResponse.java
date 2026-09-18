package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AccomplishmentFeedback;
import java.time.Instant;
import java.util.UUID;

public record AccomplishmentCorrectionResponse(
        UUID id,
        AccomplishmentFeedback.Status status,
        String message,
        String staffResponse,
        Instant requestedAt,
        Instant reviewedAt,
        String reviewedByTeacherName
) {
}
