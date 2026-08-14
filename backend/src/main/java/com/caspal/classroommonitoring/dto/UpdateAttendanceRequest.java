package com.caspal.classroommonitoring.dto;

import com.caspal.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateAttendanceRequest(
        @NotNull AttendanceStatus status
) {
}
