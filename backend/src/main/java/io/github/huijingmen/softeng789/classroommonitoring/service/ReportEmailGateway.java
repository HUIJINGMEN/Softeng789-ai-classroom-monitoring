package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.time.LocalDate;
import java.util.UUID;

public interface ReportEmailGateway {
    DeliveryResult send(EmailMessage message);

    record EmailMessage(
            UUID summaryId,
            String studentEmail,
            String studentName,
            String courseCode,
            String academicTerm,
            LocalDate dateFrom,
            LocalDate dateTo,
            String summary,
            String strengths,
            String nextSteps,
            String reportBody
    ) {
        public EmailMessage(UUID summaryId, String studentEmail, String studentName, String courseCode,
                String academicTerm, LocalDate dateFrom, LocalDate dateTo, String summary, String strengths, String nextSteps) {
            this(summaryId, studentEmail, studentName, courseCode, academicTerm, dateFrom, dateTo, summary, strengths, nextSteps, null);
        }
    }

    record DeliveryResult(String status, String message) {
    }
}
