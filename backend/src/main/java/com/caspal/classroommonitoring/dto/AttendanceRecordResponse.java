package com.caspal.classroommonitoring.dto;

import com.caspal.classroommonitoring.entity.AttendanceRecord.AttendanceSource;
import com.caspal.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
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
