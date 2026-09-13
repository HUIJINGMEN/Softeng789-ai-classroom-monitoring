package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.UUID;

public record RoomResponse(
        UUID id,
        UUID campusId,
        String campusName,
        String code,
        String name,
        int capacity
) {
}
