package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * The payload adapter boundary for the (currently non-existent) lab AI Service: whatever real
 * integration eventually calls this endpoint just needs to resolve a camera-detected person to
 * our internal studentId/sessionId first — that resolution is explicitly the AI service's
 * responsibility, not ours. Swapping the real service in later only touches the caller of this
 * endpoint, never the rest of the system.
 */
public record IngestHealthEventRequest(
        @NotNull UUID studentId,
        @NotNull UUID sessionId,
        @NotBlank String eventType,
        BigDecimal confidence,
        Instant detectedAt,
        String evidenceUrl
) {
}
