package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Accomplishment;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record AccomplishmentResponse(
        UUID id,
        UUID studentId,
        String studentName,
        String studentNumber,
        UUID courseOfferingId,
        String classLabel,
        Accomplishment.Category category,
        String title,
        String description,
        String studentNote,
        BigDecimal points,
        LocalDate achievementDate,
        boolean includeInReport,
        Accomplishment.Status status,
        UUID createdByTeacherId,
        String createdByTeacherName,
        String confirmedByTeacherName,
        Instant createdAt,
        Instant confirmedAt,
        Instant revokedAt,
        Instant acknowledgedAt,
        AccomplishmentCorrectionResponse latestCorrection
) {
}
