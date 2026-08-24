package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateStaffRequest(
        @NotBlank String staffNumber,
        @NotBlank @Email String email,
        @NotBlank String name,
        @NotBlank String role
) {
}
