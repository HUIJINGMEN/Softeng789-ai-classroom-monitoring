package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StudentAccomplishmentFeedbackRequest(
        @NotBlank @Size(max = 1200) String message
) {
}
