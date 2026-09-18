package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record AccomplishmentEntryRequest(
        @NotNull UUID studentId,
        @DecimalMin("0.0") BigDecimal points,
        @Size(max = 2000) String note
) {
}
