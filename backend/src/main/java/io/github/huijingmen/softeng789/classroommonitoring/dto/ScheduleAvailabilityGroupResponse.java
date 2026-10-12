package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Only unavailable resources are returned; an absent id is available for every slot in the group. */
public record ScheduleAvailabilityGroupResponse(
        String key,
        List<LocalDate> courseConflicts,
        Map<UUID, List<LocalDate>> roomConflicts,
        Map<UUID, List<LocalDate>> teacherConflicts
) {
}
