package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record BatchAttendanceResponse(
        Map<UUID, List<AttendanceRecordResponse>> attendanceBySessionId
) {
}
