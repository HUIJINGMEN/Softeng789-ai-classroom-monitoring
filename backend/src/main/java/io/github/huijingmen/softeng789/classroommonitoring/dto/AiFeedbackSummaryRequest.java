package io.github.huijingmen.softeng789.classroommonitoring.dto;

import java.time.LocalDate;
import java.util.List;

/** De-identified evidence sent to the private report-summary service. */
public record AiFeedbackSummaryRequest(
        String classLabel,
        LocalDate dateFrom,
        LocalDate dateTo,
        List<String> feedback
) {
}
