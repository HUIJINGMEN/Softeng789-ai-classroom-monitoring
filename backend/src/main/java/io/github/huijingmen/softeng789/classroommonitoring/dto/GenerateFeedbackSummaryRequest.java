package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public record GenerateFeedbackSummaryRequest(
        @NotNull UUID studentId,
        @NotNull UUID courseOfferingId,
        @NotNull LocalDate dateFrom,
        @NotNull LocalDate dateTo
) {
}
