package com.caspal.classroommonitoring.dto;

import com.caspal.classroommonitoring.entity.ClassroomSession.SessionStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;

public record CreateClassroomSessionRequest(
        @NotBlank String course,
        @NotBlank String room,
        String teacherName,
        String teacherEmail,
        String teacherStaffNumber,
        @NotNull LocalDate date,
        @NotNull Instant startTime,
        @NotNull Instant endTime,
        SessionStatus status
) {
}
