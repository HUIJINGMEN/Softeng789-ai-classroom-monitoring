package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceSource;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record StudentAttendanceHistoryResponse(
        UUID sessionId,
        String course,
        String room,
        UUID campusId,
        String campusName,
        LocalDate sessionDate,
        Instant startTime,
        Instant endTime,
        AttendanceStatus status,
        Instant checkInTime,
        Instant checkOutTime,
        AttendanceSource source
) {
}
