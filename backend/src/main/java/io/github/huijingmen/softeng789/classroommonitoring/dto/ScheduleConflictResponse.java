package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.time.LocalDate;
import java.util.UUID;

public record ScheduleConflictResponse(
        String type,
        LocalDate date,
        UUID existingSessionId,
        String message,
        boolean overridable
) {
}
