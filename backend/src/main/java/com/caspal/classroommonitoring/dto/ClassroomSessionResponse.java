package com.caspal.classroommonitoring.dto;

import com.caspal.classroommonitoring.entity.ClassroomSession.SessionStatus;
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
        UUID teacherId,
        String teacherName,
        String teacherEmail,
        LocalDate date,
        Instant startTime,
        Instant endTime,
        SessionStatus status
) {
}
