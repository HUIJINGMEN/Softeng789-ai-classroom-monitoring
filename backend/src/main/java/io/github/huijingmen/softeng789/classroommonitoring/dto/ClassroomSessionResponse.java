package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ClassroomSessionResponse(
        UUID id,
        String course,
        String room,
        UUID courseOfferingId,
        String courseOfferingCode,
        UUID roomId,
        UUID campusId,
        String campusName,
        UUID teacherId,
        String teacherName,
        String teacherEmail,
        LocalDate date,
        Instant startTime,
        Instant endTime,
        SessionStatus status
) {
}
