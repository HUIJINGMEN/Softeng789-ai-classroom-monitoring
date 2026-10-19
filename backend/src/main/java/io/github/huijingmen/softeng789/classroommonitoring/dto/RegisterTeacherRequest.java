package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterTeacherRequest(
        @NotBlank String staffNumber,
        @NotBlank @Email String email,
        @NotBlank String name,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @jakarta.validation.constraints.Pattern(regexp = "[A-Za-z0-9_-]{43}") String emailProof
) {
    public RegisterTeacherRequest(String staffNumber, String email, String name, String password) {
        this(staffNumber, email, name, password, null);
    }
    @Override public String toString() { return "RegisterTeacherRequest[redacted]"; }
}
