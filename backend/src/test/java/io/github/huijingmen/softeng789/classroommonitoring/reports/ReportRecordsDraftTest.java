package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static org.assertj.core.api.Assertions.*;

class ReportRecordsDraftTest {
    private Generation draft(Topic topic, AttendanceSummary attendance, List<InvoiceSummary> invoices) {
        var snapshot = new Snapshot(new StudentInfo("Student", "S-1", "student@example.test", "Engineering", "3"),
                List.of(), attendance, List.of(), List.of(), 0, new PaymentSnapshot(invoices, 0));
        return ReportRecordsDraft.generate(new Document(LocalDate.of(2026, 8, 12), LocalDate.of(2026, 10, 12),
                List.of(), List.of(), List.of(), snapshot), topic);
    }
    private InvoiceSummary invoice(String currency, String received, String balance, String pending, LocalDate due) {
        return new InvoiceSummary("TEST-1", currency, LocalDate.of(2026, 10, 1), due,
                new BigDecimal("1200"), BigDecimal.ZERO, new BigDecimal(received), new BigDecimal(balance),
                new BigDecimal(pending), "PENDING");
    }
    @Test void eightScheduledLessonsAreNotEightLessonsAttended() {
        var result = draft(Topic.ATTENDANCE, new AttendanceSummary(8, 3, 1, 2, 2, 67), List.of());
        assertThat(result.summary()).contains("8 past scheduled lessons", "you attended 4", "3 present and 1 late",
                "2 absences", "67%", "2 lessons have no recorded mark", "not counted as absences");
        assertThat(result.summary()).doesNotContain("completed 8", "completed eight");
        assertThat(result.provider()).isEqualTo("RECORDS");
    }
    @Test void unrecordedMarksDoNotBecomeAZeroAttendanceRate() {
        assertThat(draft(Topic.ATTENDANCE, new AttendanceSummary(2, 0, 0, 0, 2, null), List.of()).summary())
                .contains("no recorded attendance marks", "0 absences").doesNotContain("0%");
        assertThat(draft(Topic.ATTENDANCE, new AttendanceSummary(0, 0, 0, 0, 0, null), List.of()).summary())
                .contains("no past scheduled lessons", "not available yet");
    }
    @Test void pendingInvoiceDoesNotInventAPendingPaymentSubmission() {
        var result = draft(Topic.PAYMENTS, null, List.of(invoice("NZD", "0", "1200", "0", LocalDate.of(2026, 10, 21))));
        assertThat(result.summary()).contains("NZD 0.00", "NZD 1200.00", "21 Oct 2026",
                "not just activity in the reporting period", "or the whole account");
        assertThat(result.summary()).doesNotContain("awaiting verification", "submitted", "Thank you for the confirmed");
    }
    @Test void realPendingSubmissionIsNotSubtractedOrThankedAsReceived() {
        var result = draft(Topic.PAYMENTS, null, List.of(invoice("NZD", "250", "950", "950", null)));
        assertThat(result.summary()).contains("Thank you for the confirmed net payments of NZD 250.00",
                "balance is NZD 950.00", "NZD 950.00 are awaiting verification",
                "have not reduced this balance", "before making another transfer");
        assertThat(result.summary()).doesNotContain("due date");
    }
    @Test void currenciesAreNeverAddedTogetherAndDueDateOnlyUsesUnpaidInvoices() {
        var result = draft(Topic.PAYMENTS, null, List.of(
                invoice("NZD", "0", "1200", "0", LocalDate.of(2026, 10, 21)),
                invoice("USD", "10", "20", "0", LocalDate.of(2026, 10, 22)),
                invoice("NZD", "100", "0", "0", LocalDate.of(2026, 1, 1))));
        assertThat(result.summary()).contains("NZD 1200.00", "USD 20.00", "21 Oct 2026", "22 Oct 2026")
                .doesNotContain("1220", "1 Jan 2026");
    }
    @Test void missingBillingDoesNotClaimNothingIsOwed() {
        assertThat(draft(Topic.PAYMENTS, null, List.of()).summary()).contains("does not mean that nothing is owed");
    }
    @Test void clearScopedBalanceDoesNotDeclareTheWholeAccountPaid() {
        assertThat(draft(Topic.PAYMENTS, null, List.of(invoice("NZD", "1200", "0", "0", null))).summary())
                .contains("no outstanding balance on these included invoices", "not just activity")
                .doesNotContain("whole account is settled");
    }
}
