package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReviewFeedbackSummaryRequest(
        @NotBlank @Size(max = 4000) String summary,
        @NotBlank @Size(max = 2500) String strengths,
        @NotBlank @Size(max = 2500) String nextSteps
) {
}
