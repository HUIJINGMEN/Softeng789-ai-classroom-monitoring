package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.StudentLevel;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record StaffCreateStudentRequest(
        @NotBlank String studentNumber,
        @NotBlank @Email String universityEmail,
        @NotBlank String firstName,
        @NotBlank String lastName,
        String programme,
        @NotEmpty List<UUID> classOfferingIds,
        @AssertTrue(message = "Student consent must be confirmed before face enrollment.") boolean consentGiven,
        @NotNull StudentLevel level
) {
}
