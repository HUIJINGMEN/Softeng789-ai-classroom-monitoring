package io.github.huijingmen.softeng789.classroommonitoring.reports;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Explicit report contract: evidence is server-owned; only narrative text is editable. */
public final class ReportModels {
    private ReportModels() { }
    public enum Topic { ATTENDANCE, PAYMENTS, ABSENCES, LEARNING, ACHIEVEMENTS, OVERVIEW }
    public record Scope(@NotNull UUID studentId, @NotNull LocalDate dateFrom,
                        @NotNull LocalDate dateTo, @NotEmpty @Size(max = 30) List<@NotNull UUID> courseOfferingIds) { }
    public record Section(Topic topic, String title, List<String> evidence, String fingerprint,
                          String text, String provider, boolean reviewed, boolean stale,
                          String reviewedBy, Instant reviewedAt) { }
    public record Document(LocalDate dateFrom, LocalDate dateTo, List<UUID> courseOfferingIds,
                           List<String> courseLabels, List<Section> sections, Snapshot snapshot) {
        /** Older stored reports have no snapshot; never substitute today's data into them. */
        public Document(LocalDate dateFrom, LocalDate dateTo, List<UUID> ids, List<String> labels, List<Section> sections) {
            this(dateFrom, dateTo, ids, labels, sections, null);
        }
    }
    public record StudentInfo(String fullName, String studentNumber, String email, String programme, String level) { }
    public record AttendanceSummary(long completed, long present, long late, long absent, long unrecorded, Integer rate) { }
    public record CourseSummary(UUID id, String code, String name, String term, List<String> teachers,
                                String enrolmentStatus, AttendanceSummary attendance) { }
    public record AttendancePoint(LocalDate weekOf, AttendanceSummary attendance) { }
    public record EventCount(String type, long count) { }
    public record InvoiceSummary(String number, String currency, LocalDate issued, LocalDate due,
                                 BigDecimal charges, BigDecimal credits, BigDecimal received,
                                 BigDecimal balance, BigDecimal awaitingVerification, String status) { }
    public record PaymentSnapshot(List<InvoiceSummary> invoices, int excludedInvoices) { }
    public record Snapshot(StudentInfo student, List<CourseSummary> courses, AttendanceSummary attendance,
                           List<AttendancePoint> attendanceTrend, List<EventCount> confirmedEvents,
                           int feedbackCount, PaymentSnapshot payments, Instant preparedAt) {
        public Snapshot(StudentInfo student, List<CourseSummary> courses, AttendanceSummary attendance,
                List<AttendancePoint> trend, List<EventCount> events, int feedbackCount, PaymentSnapshot payments) {
            this(student, courses, attendance, trend, events, feedbackCount, payments, null);
        }
    }
    public record View(UUID id, UUID studentId, String studentName, long version, Instant createdAt,
                       Instant publishedAt, Document document) { }
    public record Edit(@NotNull Long version, @NotBlank @Size(max = 6000) String text,
                       boolean approve, boolean evidenceReviewed) {
        public Edit(Long version, String text, boolean approve) { this(version, text, approve, false); }
    }
    public record Revision(@NotNull Long version) { }
    public record Generation(String summary, String strengths, String nextSteps, String provider) { }
    public record AiRequest(String classLabel, LocalDate dateFrom, LocalDate dateTo,
                            List<String> feedback, String section, String audience) {
        public AiRequest(String label, LocalDate from, LocalDate to, List<String> facts, String section) {
            this(label, from, to, facts, section, "STUDENT");
        }
    }
}
