package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceSource;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import java.time.Instant;
import java.util.UUID;

public record AttendanceRecordResponse(
        UUID id,
        UUID studentId,
        String studentNumber,
        String studentName,
        UUID sessionId,
        AttendanceStatus status,
        Instant checkInTime,
        Instant checkOutTime,
        AttendanceSource source
) {
}
