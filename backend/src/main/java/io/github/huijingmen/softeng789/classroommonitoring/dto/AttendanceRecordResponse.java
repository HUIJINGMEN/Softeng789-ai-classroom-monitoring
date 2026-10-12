package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceSource;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AbsenceReason;
import java.time.Instant;
import java.util.UUID;

public record AttendanceRecordResponse(
        UUID id,
        UUID studentId,
        String studentNumber,
        String studentName,
        UUID sessionId,
        AttendanceStatus status,
        AbsenceReason absenceReason,
        String absenceNote,
        Instant checkInTime,
        Instant checkOutTime,
        AttendanceSource source
) {
}
