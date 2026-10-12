package io.github.huijingmen.softeng789.classroommonitoring.billing.dto;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonMakeupRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class LessonMakeupRequestDtos {
    private LessonMakeupRequestDtos() {
    }

    public enum ReviewDecision {
        APPROVE,
        DECLINE
    }

    public record CreateMakeupRequest(
            @NotNull UUID lessonCreditId,
            @NotNull UUID preferredSessionId,
            @Size(max = 500) String note
    ) {
    }

    public record ReviewMakeupRequest(
            @NotNull ReviewDecision decision,
            @Size(max = 500) String note
    ) {
    }

    public record LessonMakeupRequestResponse(
            UUID id,
            UUID lessonCreditId,
            UUID studentId,
            String studentName,
            String studentNumber,
            UUID courseOfferingId,
            String courseCode,
            LocalDate missedSessionDate,
            LocalDate creditExpiresOn,
            UUID preferredSessionId,
            LocalDate preferredSessionDate,
            Instant preferredStartTime,
            Instant preferredEndTime,
            String room,
            String campus,
            LessonMakeupRequestStatus status,
            String studentNote,
            String reviewNote,
            Instant submittedAt,
            Instant reviewedAt
    ) {
    }

    public record AdminMakeupRequestsResponse(
            long submittedCount,
            PageResponse<LessonMakeupRequestResponse> page
    ) {
    }
}
