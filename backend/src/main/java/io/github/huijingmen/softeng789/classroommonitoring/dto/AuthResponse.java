package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.UUID;

public record AuthResponse(
        @com.fasterxml.jackson.annotation.JsonIgnore String token,
        String role,
        UUID id,
        String name,
        String email,
        /** Only meaningful for role == "student": PENDING, APPROVED, or REJECTED. */
        String approvalStatus
) {
    @Override
    public String toString() {
        return "AuthResponse[role=" + role + ", id=" + id + ", approvalStatus=" + approvalStatus + "]";
    }
}
