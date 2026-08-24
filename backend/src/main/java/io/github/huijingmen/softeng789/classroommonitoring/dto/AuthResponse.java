package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.UUID;

public record AuthResponse(
        String token,
        String role,
        UUID id,
        String name,
        String email
) {
}
