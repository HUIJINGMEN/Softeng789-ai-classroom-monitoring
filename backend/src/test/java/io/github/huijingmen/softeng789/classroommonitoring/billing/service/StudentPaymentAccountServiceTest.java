package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentAccountState;
import java.util.Set;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class StudentPaymentAccountServiceTest {
    @Test
    void paymentEvidenceTakesPriorityOverTheUnderlyingInvoiceState() {
        assertThat(StudentPaymentAccountPolicy.deriveState(
                true,
                Set.of(InvoiceStatus.OVERDUE),
                1
        )).isEqualTo(StudentPaymentAccountState.PAYMENT_REVIEW);
    }

    @Test
    void overdueAndAdministrativeWorkStayAheadOfOrdinaryPaymentStates() {
        assertThat(StudentPaymentAccountPolicy.deriveState(
                false,
                Set.of(InvoiceStatus.PAID, InvoiceStatus.OVERDUE),
                0
        )).isEqualTo(StudentPaymentAccountState.OVERDUE);
        assertThat(StudentPaymentAccountPolicy.deriveState(
                false,
                Set.of(InvoiceStatus.PAID, InvoiceStatus.DRAFT),
                0
        )).isEqualTo(StudentPaymentAccountState.DRAFT);
        assertThat(StudentPaymentAccountPolicy.deriveState(
                false,
                Set.of(InvoiceStatus.PAID),
                1
        )).isEqualTo(StudentPaymentAccountState.NEEDS_INVOICE);
    }

    @Test
    void settledAndUnbilledStudentsAreNotBothCalledPaid() {
        assertThat(StudentPaymentAccountPolicy.deriveState(
                false,
                Set.of(InvoiceStatus.PAID),
                0
        )).isEqualTo(StudentPaymentAccountState.PAID);
        assertThat(StudentPaymentAccountPolicy.deriveState(
                false,
                Set.of(),
                0
        )).isEqualTo(StudentPaymentAccountState.NO_PAYMENT_DUE);
    }
}
