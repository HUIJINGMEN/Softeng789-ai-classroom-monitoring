package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public record GenerateReportInsightRequest(
        @NotBlank String scope,
        UUID courseOfferingId,
        @NotNull LocalDate dateFrom,
        @NotNull LocalDate dateTo
) {
}
