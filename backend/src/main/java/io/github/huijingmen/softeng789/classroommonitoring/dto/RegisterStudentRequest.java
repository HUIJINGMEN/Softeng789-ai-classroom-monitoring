package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record RegisterStudentRequest(
        @NotBlank String studentNumber,
        @NotBlank @Email String universityEmail,
        @NotBlank String fullName,
        @NotBlank String course,
        List<UUID> classOfferingIds,
        @NotBlank @Size(min = 8, max = 72) String password,
        @AssertTrue(message = "Consent is required to register.") boolean consentGiven
) {
}
