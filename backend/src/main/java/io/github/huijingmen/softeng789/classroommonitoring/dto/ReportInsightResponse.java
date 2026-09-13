package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.time.LocalDate;
import java.util.UUID;

public record ReportInsightResponse(
        String scope,
        UUID courseOfferingId,
        String title,
        LocalDate dateFrom,
        LocalDate dateTo,
        String summary,
        String strengths,
        String nextSteps,
        int sourceFeedbackCount,
        String provider
) {
}
