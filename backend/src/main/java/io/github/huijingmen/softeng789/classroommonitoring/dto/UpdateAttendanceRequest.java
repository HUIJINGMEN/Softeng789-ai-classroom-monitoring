package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AbsenceReason;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateAttendanceRequest(
        @NotNull AttendanceStatus status,
        AbsenceReason absenceReason,
        @Size(max = 500) String absenceNote
) {
    public UpdateAttendanceRequest(AttendanceStatus status) {
        this(status, null, null);
    }
}
