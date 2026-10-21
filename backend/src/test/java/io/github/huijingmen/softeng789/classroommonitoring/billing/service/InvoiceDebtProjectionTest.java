package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.*;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InvoiceDebtProjectionTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 18);

    @Test
    void overdueIsOnlyTheUnpaidPastDuePortionOfAnAccount() {
        var paid = invoice(InvoiceStatus.PAID, "500", "500", -20);
        var overdue = invoice(InvoiceStatus.PENDING, "85", "0", -13);
        var future = invoice(InvoiceStatus.OVERDUE, "500", "0", 12);
        var row = StudentPaymentAccountAssembler.row(new Student(), List.of(paid, overdue, future), List.of(), null, TODAY);
        assertThat(row.issued()).isEqualByComparingTo("1085.00");
        assertThat(row.received()).isEqualByComparingTo("500.00");
        assertThat(row.balance()).isEqualByComparingTo("585.00");
        assertThat(row.overdueBalance()).isEqualByComparingTo("85.00");
        assertThat(row.balance().subtract(row.overdueBalance())).isEqualByComparingTo("500.00");
        assertThat(row.state()).isEqualTo(StudentPaymentAccountState.OVERDUE);
        assertThat(row.nextDueDate()).isEqualTo(TODAY.minusDays(13));
    }

    @Test
    void lifecycleDatesAndPaymentEvidenceDetermineDebtNotTheSavedFinancialLabel() {
        for (InvoiceStatus stored : InvoiceStatus.values()) {
            for (int dueOffset : new int[]{-1, 0, 1}) {
                for (int paid : new int[]{0, 20, 100, 150}) {
                    var debt = InvoiceDebtProjection.from(stored, TODAY.plusDays(dueOffset),
                            new BigDecimal("100"), BigDecimal.valueOf(paid), TODAY);
                    int expected = stored == InvoiceStatus.DRAFT || stored == InvoiceStatus.CANCELLED ? 0 : Math.max(100 - paid, 0);
                    assertThat(debt.outstanding()).isEqualByComparingTo(BigDecimal.valueOf(expected));
                    assertThat(debt.overdue()).isEqualByComparingTo(BigDecimal.valueOf(dueOffset < 0 ? expected : 0));
                }
            }
        }
    }

    @Test
    void creditsRefundsAndFailedPaymentsHaveTheSameEffectsInTheAccountAndInvoiceProjection() {
        var invoice = invoice(InvoiceStatus.PENDING, "100", "80", -1);
        var credit = new InvoiceLineItem(); credit.setType(LineItemType.CREDIT); credit.setAmount(new BigDecimal("10")); invoice.addLineItem(credit);
        var refund = new PaymentTransaction(); refund.setStatus(PaymentStatus.REFUNDED); refund.setAmount(new BigDecimal("20")); invoice.addTransaction(refund);
        var failed = new PaymentTransaction(); failed.setStatus(PaymentStatus.FAILED); failed.setAmount(new BigDecimal("1000")); invoice.addTransaction(failed);
        var draft = invoice(InvoiceStatus.DRAFT, "999", "0", -1);
        var cancelled = invoice(InvoiceStatus.CANCELLED, "999", "0", -1);
        var row = StudentPaymentAccountAssembler.row(new Student(), List.of(invoice, draft, cancelled), List.of(), null, TODAY);
        assertThat(row.issued()).isEqualByComparingTo("90");
        assertThat(row.received()).isEqualByComparingTo("60");
        assertThat(row.balance()).isEqualByComparingTo("30");
        assertThat(row.overdueBalance()).isEqualByComparingTo("30");
        assertThat(InvoiceDebtProjection.from(invoice, TODAY).overdue()).isEqualByComparingTo(row.overdueBalance());
    }

    @Test
    void awaitingVerificationDoesNotReduceDebtOrHideItsOverduePortion() {
        var invoice = invoice(InvoiceStatus.PENDING, "85", "0", -1);
        var pending = new ManualPaymentSubmission(); pending.setInvoice(invoice); pending.setAmount(new BigDecimal("50"));
        var row = StudentPaymentAccountAssembler.row(new Student(), List.of(invoice), List.of(pending), null, TODAY);
        assertThat(row.state()).isEqualTo(StudentPaymentAccountState.PAYMENT_REVIEW);
        assertThat(row.received()).isZero();
        assertThat(row.balance()).isEqualByComparingTo("85");
        assertThat(row.overdueBalance()).isEqualByComparingTo("85");
        assertThat(row.paymentReported()).isEqualByComparingTo("50");
    }

    @Test
    void accountTotalsCannotSilentlyLabelMixedCurrenciesAsNzd() {
        var foreign = invoice(InvoiceStatus.PENDING, "85", "0", -1); foreign.setCurrency("USD");
        assertThatThrownBy(() -> StudentPaymentAccountAssembler.row(new Student(), List.of(foreign), List.of(), null, TODAY))
                .hasMessageContaining("different currencies");
    }

    private static StudentInvoice invoice(InvoiceStatus status, String charge, String paid, int dueOffset) {
        var invoice = new StudentInvoice(); invoice.setStatus(status); invoice.setDueDate(TODAY.plusDays(dueOffset));
        var item = new InvoiceLineItem(); item.setType(LineItemType.CHARGE); item.setAmount(new BigDecimal(charge)); invoice.addLineItem(item);
        if (new BigDecimal(paid).signum() > 0) {
            var receipt = new PaymentTransaction(); receipt.setStatus(PaymentStatus.SUCCEEDED); receipt.setAmount(new BigDecimal(paid)); invoice.addTransaction(receipt);
        }
        return invoice;
    }
}
