package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateAttendanceRequest(
        @NotNull AttendanceStatus status
) {
}
