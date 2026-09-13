package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.BehaviourEvent.ReviewStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record BehaviourEventResponse(
        UUID id,
        UUID studentId,
        String trackId,
        String eventType,
        UUID sessionId,
        Instant timestamp,
        int durationSeconds,
        BigDecimal confidence,
        ReviewStatus reviewStatus,
        String correctedFrom
) {
}
