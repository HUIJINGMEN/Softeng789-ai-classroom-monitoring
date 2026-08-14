package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;

public record UpdateClassroomSessionRequest(
        @NotBlank String course,
        @NotBlank String room,
        String teacherName,
        String teacherEmail,
        String teacherStaffNumber,
        @NotNull LocalDate date,
        @NotNull Instant startTime,
        @NotNull Instant endTime,
        @NotNull SessionStatus status
) {
}
