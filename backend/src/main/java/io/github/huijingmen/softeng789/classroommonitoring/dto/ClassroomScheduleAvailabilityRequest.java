package io.github.huijingmen.softeng789.classroommonitoring.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * Availability is checked in assignment groups: the shared defaults are one group and every
 * customised weekday is another. This lets the timetable builder update all teacher and room
 * choices with one request whenever its dates or times change.
 */
public record ClassroomScheduleAvailabilityRequest(
        @NotNull UUID courseOfferingId,
        @NotEmpty @Size(max = 8) List<@NotNull @Valid ScheduleAvailabilityGroupRequest> groups,
        @Size(max = 200) List<@NotNull UUID> ignoredSessionIds
) {
    public ClassroomScheduleAvailabilityRequest(
            UUID courseOfferingId,
            List<ScheduleAvailabilityGroupRequest> groups
    ) {
        this(courseOfferingId, groups, List.of());
    }

    public ClassroomScheduleAvailabilityRequest {
        ignoredSessionIds = ignoredSessionIds == null ? List.of() : List.copyOf(ignoredSessionIds);
    }
}
