package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.UUID;

public record CampusResponse(
        UUID id,
        String name,
        int roomCount
) {
}
