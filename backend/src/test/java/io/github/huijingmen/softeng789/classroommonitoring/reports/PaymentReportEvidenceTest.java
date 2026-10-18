package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

class PaymentReportEvidenceTest {
    @Test void scopedEvidenceSeparatesConfirmedReceiptsPendingReportsAndPeriodActivity() {
        UUID student = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        var course = mock(CourseOffering.class);
        when(course.getId()).thenReturn(courseId);
        var entitlement = new StudentLearningEntitlement();
        entitlement.setCourseOffering(course);
        var invoice = mock(StudentInvoice.class);
        when(invoice.getId()).thenReturn(UUID.randomUUID());
        when(invoice.getInvoiceNumber()).thenReturn("SCOPED");
        when(invoice.getCurrency()).thenReturn("NZD");
        when(invoice.getCreatedAt()).thenReturn(Instant.parse("2026-09-01T00:00:00Z"));
        when(invoice.getDueDate()).thenReturn(LocalDate.of(2099, 10, 31));
        when(invoice.getStatus()).thenReturn(InvoiceStatus.PENDING);
        when(invoice.getEntitlements()).thenReturn(List.of(entitlement));
        var charge = new InvoiceLineItem(); charge.setType(LineItemType.CHARGE); charge.setAmount(new BigDecimal("500"));
        when(invoice.getLineItems()).thenReturn(List.of(charge));
        var received = new PaymentTransaction(); received.setStatus(PaymentStatus.SUCCEEDED);
        received.setAmount(new BigDecimal("250")); received.setOccurredAt(Instant.parse("2026-10-03T00:00:00Z"));
        var failed = new PaymentTransaction(); failed.setStatus(PaymentStatus.FAILED);
        failed.setAmount(new BigDecimal("250")); failed.setOccurredAt(Instant.parse("2026-09-02T00:00:00Z"));
        when(invoice.getTransactions()).thenReturn(List.of(received, failed));
        var unlinked = mock(StudentInvoice.class);
        when(unlinked.getEntitlements()).thenReturn(List.of());
        var reported = new ManualPaymentSubmission(); reported.setInvoice(invoice); reported.setAmount(new BigDecimal("250"));
        var invoices = mock(StudentInvoiceRepository.class);
        var submissions = mock(ManualPaymentSubmissionRepository.class);
        when(invoices.findStatementByStudentId(student)).thenReturn(List.of(invoice, unlinked));
        when(submissions.findByInvoiceStudentIdOrderBySubmittedAtDesc(student)).thenReturn(List.of(reported));
        var scope = new Scope(student, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 12), List.of(courseId));
        var result = new PaymentReportEvidence(invoices, submissions).buildDetailed(scope);
        var facts = result.section().evidence();
        assertThat(facts).anyMatch(text -> text.contains("confirmed net receipts to date=250.00") && text.contains("current balance=250.00") && text.contains("issued in selected period=false"));
        assertThat(facts).contains("Awaiting verification, not confirmed received: SCOPED NZD 250");
        assertThat(facts).anyMatch(text -> text.contains("not the student's whole-account balance"));
        assertThat(facts).noneMatch(text -> text.startsWith("Period transaction") && text.contains("FAILED"));
        assertThat(result.snapshot().invoices()).hasSize(1);
        assertThat(result.snapshot().excludedInvoices()).isEqualTo(1);
        assertThat(result.snapshot().invoices().getFirst().received()).isEqualByComparingTo("250");
        assertThat(result.snapshot().invoices().getFirst().status()).isEqualTo("PARTIALLY_PAID");
        assertThat(result.snapshot().invoices().getFirst().balance()).isEqualByComparingTo("250");
        assertThat(result.snapshot().invoices().getFirst().awaitingVerification()).isEqualByComparingTo("250");
    }
}
