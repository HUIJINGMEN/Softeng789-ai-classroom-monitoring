package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.time.LocalDate;
import java.util.List;

/** Replace this boundary when the laboratory summary service contract is available. */
public interface FeedbackSummaryGateway {
    GeneratedSummary summarize(
            String studentName,
            String classLabel,
            LocalDate dateFrom,
            LocalDate dateTo,
            List<String> feedback
    );

    record GeneratedSummary(String summary, String strengths, String nextSteps, String provider) {
    }
}
