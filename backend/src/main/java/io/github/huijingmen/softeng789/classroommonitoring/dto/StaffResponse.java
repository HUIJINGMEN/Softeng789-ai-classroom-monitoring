package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.UUID;

public record StaffResponse(
        UUID id,
        String staffNumber,
        String email,
        String name,
        String role,
        boolean passwordSet,
        String status
) {
}
