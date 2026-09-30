package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Provider-neutral observation emitted by the classroom AI pipeline. */
public record IngestBehaviourEventRequest(
        @NotBlank @Size(max = 120) String externalEventId,
        @NotNull UUID sessionId,
        UUID studentId,
        @NotBlank @Size(max = 120) String trackId,
        @NotBlank @Size(max = 120) String eventType,
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal confidence,
        @NotNull Instant detectedAt,
        @NotNull @Min(0) @Max(86400) Integer durationSeconds,
        @Size(max = 500) String evidenceUrl,
        @NotBlank @Size(max = 80) String modelVersion
) {
}
