package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record CreateClassroomSessionRequest(
        @NotNull UUID courseOfferingId,
        @NotBlank String room,
        String teacherEmail,
        String teacherStaffNumber,
        @NotNull LocalDate date,
        @NotNull Instant startTime,
        @NotNull Instant endTime,
        SessionStatus status
) {
}
