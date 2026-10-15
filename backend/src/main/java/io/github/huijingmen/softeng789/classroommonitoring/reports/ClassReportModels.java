package io.github.huijingmen.softeng789.classroommonitoring.reports;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

/** Staff-only class document. Financial snapshots must never be published to the student portal. */
public final class ClassReportModels {
    private ClassReportModels() { }
    public record Scope(@NotNull UUID courseOfferingId, @NotNull LocalDate dateFrom, @NotNull LocalDate dateTo) { }
    public record ClassInfo(UUID id, String code, String name, String term, List<String> teachers) { }
    public record StudentRow(UUID id, String name, String number, AttendanceSummary attendance) { }
    public record SessionRow(UUID id, LocalDate date, Instant startTime, String room, AttendanceSummary attendance) { }
    public record CurrencyTotal(String currency, int invoices, BigDecimal charges, BigDecimal credits,
                                BigDecimal received, BigDecimal balance, BigDecimal awaitingVerification) { }
    public record Payments(List<CurrencyTotal> totals, int excludedInvoices, int studentsWithoutInvoice) { }
    public record Snapshot(ClassInfo course, Instant preparedAt, int completedSessions, AttendanceSummary attendance,
                           List<AttendancePoint> attendanceTrend, List<EventCount> confirmedEvents,
                           List<StudentRow> students, List<SessionRow> sessions, int feedbackCount, Payments payments) { }
    public record Document(LocalDate dateFrom, LocalDate dateTo, List<Section> sections, Snapshot snapshot) {
        public Document {
            // Ignore the retired class-achievement section when reopening older documents.
            // Personal achievements and the original stored JSON remain untouched.
            sections = sections.stream().filter(section -> section.topic() != Topic.ACHIEVEMENTS).toList();
        }
    }
    public record View(UUID id, UUID courseOfferingId, String classLabel, long version, Instant createdAt,
                       Instant finalizedAt, Document document) { }
}
