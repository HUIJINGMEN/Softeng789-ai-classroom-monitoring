package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateClassFeedbackRequest(
        @NotNull UUID courseOfferingId,
        @NotBlank String comment
) {
}
