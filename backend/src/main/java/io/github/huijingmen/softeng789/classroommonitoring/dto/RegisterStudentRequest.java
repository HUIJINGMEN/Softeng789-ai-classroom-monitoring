package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.StudentLevel;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record RegisterStudentRequest(
        @NotBlank String studentNumber,
        @NotBlank @Email String universityEmail,
        @NotBlank String fullName,
        @NotBlank String course,
        @NotEmpty(message = "Select at least one class.") List<UUID> classOfferingIds,
        @NotBlank @Size(min = 8, max = 72) String password,
        @AssertTrue(message = "Consent is required to register.") boolean consentGiven,
        @NotNull StudentLevel level,
        @Pattern(regexp = "[A-Za-z0-9_-]{43}") String emailProof
) {
    public RegisterStudentRequest(String studentNumber, String universityEmail, String fullName, String course,
            List<UUID> classOfferingIds, String password, boolean consentGiven, StudentLevel level) {
        this(studentNumber, universityEmail, fullName, course, classOfferingIds, password, consentGiven, level, null);
    }
    @Override public String toString() { return "RegisterStudentRequest[redacted]"; }
}
