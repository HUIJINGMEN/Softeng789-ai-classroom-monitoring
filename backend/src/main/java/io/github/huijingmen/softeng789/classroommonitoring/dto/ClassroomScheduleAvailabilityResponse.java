package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.List;

public record ClassroomScheduleAvailabilityResponse(
        List<ScheduleAvailabilityGroupResponse> groups
) {
}
