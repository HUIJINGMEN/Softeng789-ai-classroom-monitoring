package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ClassReportPaymentsTest {
    @Test void currenciesMixedInvoicesPendingSubmissionsAndRefundsStaySeparate() {
        UUID course = UUID.randomUUID(), other = UUID.randomUUID(), first = UUID.randomUUID(), second = UUID.randomUUID();
        var nzd = invoice(first, "NZD", InvoiceStatus.PENDING, course);
        var usd = invoice(first, "USD", InvoiceStatus.PENDING, course);
        var mixed = invoice(second, "NZD", InvoiceStatus.PENDING, course, other);
        var unlinked = invoice(second, "NZD", InvoiceStatus.PENDING);
        var outside = invoice(second, "NZD", InvoiceStatus.PENDING, other);
        var draft = invoice(second, "NZD", InvoiceStatus.DRAFT, course);
        var cancelled = invoice(second, "NZD", InvoiceStatus.CANCELLED, course);
        var success = new PaymentTransaction(); success.setStatus(PaymentStatus.SUCCEEDED); success.setAmount(new BigDecimal("50"));
        var refund = new PaymentTransaction(); refund.setStatus(PaymentStatus.REFUNDED); refund.setAmount(new BigDecimal("10"));
        var failed = new PaymentTransaction(); failed.setStatus(PaymentStatus.FAILED); failed.setAmount(new BigDecimal("60"));
        when(nzd.getTransactions()).thenReturn(List.of(success, refund, failed));
        var pending = new ManualPaymentSubmission(); pending.setInvoice(nzd); pending.setAmount(new BigDecimal("60"));
        var invoices = mock(StudentInvoiceRepository.class); var submissions = mock(ManualPaymentSubmissionRepository.class);
        var ids = List.of(first, second);
        when(invoices.findByStudent_IdInOrderByDueDateAscCreatedAtDesc(ids)).thenReturn(List.of(nzd, usd, mixed, unlinked, outside, draft, cancelled));
        when(submissions.findByInvoice_Student_IdInAndStatusOrderBySubmittedAtAsc(ids, ManualPaymentStatus.PENDING)).thenReturn(List.of(pending));
        var result = new ClassReportPayments(invoices, submissions).build(course, ids);
        assertThat(result.excludedInvoices()).isEqualTo(2);
        assertThat(result.studentsWithoutInvoice()).isEqualTo(1);
        assertThat(result.totals()).hasSize(2);
        assertThat(result.totals().getFirst().currency()).isEqualTo("NZD");
        assertThat(result.totals().getFirst().received()).isEqualByComparingTo("40");
        assertThat(result.totals().getFirst().balance()).isEqualByComparingTo("60");
        assertThat(result.totals().getFirst().awaitingVerification()).isEqualByComparingTo("60");
        assertThat(result.totals().get(1).balance()).isEqualByComparingTo("100");
    }
    @Test void emptyRosterDoesNotLoadEveryInvoice() {
        var invoices = mock(StudentInvoiceRepository.class); var submissions = mock(ManualPaymentSubmissionRepository.class);
        assertThat(new ClassReportPayments(invoices, submissions).build(UUID.randomUUID(), List.of()).totals()).isEmpty();
        verifyNoInteractions(invoices, submissions);
    }
    private StudentInvoice invoice(UUID studentId, String currency, InvoiceStatus status, UUID... courses) {
        var row = mock(StudentInvoice.class); when(row.getId()).thenReturn(UUID.randomUUID()); when(row.getCurrency()).thenReturn(currency); when(row.getStatus()).thenReturn(status);
        var student = mock(Student.class); when(student.getId()).thenReturn(studentId); when(row.getStudent()).thenReturn(student);
        var entitlements = Arrays.stream(courses).map(id -> {
            var offering = mock(CourseOffering.class); when(offering.getId()).thenReturn(id);
            var item = new StudentLearningEntitlement(); item.setCourseOffering(offering); return item;
        }).toList();
        when(row.getEntitlements()).thenReturn(entitlements);
        var charge = new InvoiceLineItem(); charge.setType(LineItemType.CHARGE); charge.setAmount(new BigDecimal("100"));
        when(row.getLineItems()).thenReturn(List.of(charge)); when(row.getTransactions()).thenReturn(List.of()); return row;
    }
}
