package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record FeedbackSummaryResponse(
        UUID id,
        UUID studentId,
        String studentName,
        String studentEmail,
        UUID courseOfferingId,
        String classLabel,
        LocalDate dateFrom,
        LocalDate dateTo,
        String summary,
        String strengths,
        String nextSteps,
        int sourceFeedbackCount,
        String provider,
        String status,
        UUID createdByTeacherId,
        String createdByTeacherName,
        String reviewedByTeacherName,
        Instant createdAt,
        Instant reviewedAt,
        Instant publishedAt,
        Instant emailedAt
) {
}
