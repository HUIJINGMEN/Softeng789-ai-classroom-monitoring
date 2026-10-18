package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceLineItem;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentTransaction;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentLearningEntitlementRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentSessionPackageRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BillingOperationsAlertsTest {
    private final LocalDate today = LocalDate.of(2026, 10, 18);
    private final BillingOperationsAlerts alerts = new BillingOperationsAlerts(
            mock(StudentSessionPackageRepository.class), mock(StudentLearningEntitlementRepository.class),
            mock(LessonCreditRepository.class));

    @Test
    void overdueAlertsUseLedgerEvidenceAndKeepStoredLifecycleUntouched() {
        var earlier = invoice(InvoiceStatus.PAID, today.minusDays(3));
        var later = invoice(InvoiceStatus.PENDING, today.minusDays(1));
        var paid = invoice(InvoiceStatus.OVERDUE, today.minusDays(2));
        var receipt = new PaymentTransaction();
        receipt.setAmount(new BigDecimal("100.00"));
        receipt.setStatus(PaymentStatus.SUCCEEDED);
        paid.addTransaction(receipt);
        var draft = invoice(InvoiceStatus.DRAFT, today.minusDays(4));
        var cancelled = invoice(InvoiceStatus.CANCELLED, today.minusDays(4));

        var result = alerts.build(List.of(later, paid, draft, cancelled, earlier), today, today.plusDays(14));
        assertThat(result).extracting(row -> row.actionDate())
                .containsExactly(today.minusDays(3), today.minusDays(1));
        assertThat(result).allSatisfy(row -> {
            assertThat(row.type()).isEqualTo("OVERDUE_PAYMENT");
            assertThat(row.amount()).isEqualByComparingTo("100.00");
        });
        assertThat(earlier.getStatus()).isEqualTo(InvoiceStatus.PAID);
        assertThat(paid.getStatus()).isEqualTo(InvoiceStatus.OVERDUE);
    }

    @Test
    void emptyRecordsHaveNoFollowUpAlerts() {
        assertThat(alerts.build(List.of(), today, today.plusDays(14))).isEmpty();
    }

    private StudentInvoice invoice(InvoiceStatus status, LocalDate due) {
        var invoice = new StudentInvoice();
        invoice.setStatus(status);
        invoice.setDueDate(due);
        var student = mock(Student.class);
        when(student.getId()).thenReturn(UUID.randomUUID());
        when(student.getFullName()).thenReturn("Audit student");
        invoice.setStudent(student);
        var charge = new InvoiceLineItem();
        charge.setType(LineItemType.CHARGE);
        charge.setAmount(new BigDecimal("100.00"));
        invoice.addLineItem(charge);
        return invoice;
    }
}
