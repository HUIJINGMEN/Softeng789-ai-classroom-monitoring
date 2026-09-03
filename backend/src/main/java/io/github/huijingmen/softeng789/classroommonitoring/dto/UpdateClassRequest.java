package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateClassRequest(
        @NotBlank String academicTerm,
        @NotBlank String status
) {
}
