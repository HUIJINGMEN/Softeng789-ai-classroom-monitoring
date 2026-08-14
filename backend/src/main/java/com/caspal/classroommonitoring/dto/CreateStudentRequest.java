package com.caspal.classroommonitoring.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateStudentRequest(
        @NotBlank String studentNumber,
        @NotBlank @Email String universityEmail,
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotBlank String course,
        List<@NotBlank String> courses,
        @NotBlank String seat,
        @NotBlank String programme,
        @NotNull Boolean consentGiven
) {
}
