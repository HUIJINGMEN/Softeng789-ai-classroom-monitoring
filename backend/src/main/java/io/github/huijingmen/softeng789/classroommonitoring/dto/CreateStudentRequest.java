package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.StudentLevel;
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
        @NotNull Boolean consentGiven,
        @NotNull StudentLevel level
) {
}
