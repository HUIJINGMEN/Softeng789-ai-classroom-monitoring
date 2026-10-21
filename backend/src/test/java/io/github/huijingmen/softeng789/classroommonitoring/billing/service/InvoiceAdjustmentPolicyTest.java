package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class InvoiceAdjustmentPolicyTest {
    @Test
    void paidAndPartPaidInvoicesCannotGainHiddenSurplusFromCredits() {
        StudentInvoice invoice = invoice("100.00", "100.00");
        assertThatThrownBy(() -> require(invoice, AccountAdjustmentType.CREDIT, "0.01"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("current amount due");

        for (int paidCents = 0; paidCents < 10000; paidCents += 137) {
            StudentInvoice partPaid = invoice("100.00", BigDecimal.valueOf(paidCents, 2).toPlainString());
            BigDecimal due = InvoiceAmounts.balance(partPaid);
            assertThat(require(partPaid, AccountAdjustmentType.CREDIT, due.toPlainString())).isEqualByComparingTo(due);
            assertThatThrownBy(() -> require(partPaid, AccountAdjustmentType.CREDIT, due.add(new BigDecimal("0.01")).toPlainString()))
                    .isInstanceOf(ResponseStatusException.class);
            // Rejection never creates a line, transaction or status change.
            assertThat(partPaid.getLineItems()).hasSize(1);
            assertThat(InvoiceAmounts.balance(partPaid)).isEqualByComparingTo(due);
        }
    }

    @Test
    void refundOfLegacySurplusDoesNotCreateAnotherFeeCredit() {
        StudentInvoice invoice = invoice("100.00", "100.00");
        InvoiceLineItem legacyCredit = new InvoiceLineItem();
        legacyCredit.setType(LineItemType.CREDIT);
        legacyCredit.setAmount(new BigDecimal("50.00"));
        invoice.addLineItem(legacyCredit);
        assertThat(InvoiceAmounts.overpayment(invoice)).isEqualByComparingTo("50.00");
        assertThat(require(invoice, AccountAdjustmentType.REFUND, "100.00")).isEqualByComparingTo("100.00");
        assertThat(InvoiceAdjustmentPolicy.feeCredit(invoice, AccountAdjustmentType.REFUND, new BigDecimal("50.00"))).isZero();
        assertThat(InvoiceAdjustmentPolicy.feeCredit(invoice, AccountAdjustmentType.REFUND, new BigDecimal("60.00")))
                .isEqualByComparingTo("10.00");
    }

    @Test
    void everyAdjustmentRejectsRoundingOverflowZeroAndNegativeInputs() {
        StudentInvoice invoice = invoice("100.00", "60.00");
        for (AccountAdjustmentType type : AccountAdjustmentType.values()) {
            for (String invalid : List.of("99.995", "0.001", "0", "-1", "10000000000.00")) {
                assertThatThrownBy(() -> require(invoice, type, invalid))
                        .isInstanceOf(ResponseStatusException.class).hasMessageContaining("two decimal places");
            }
            assertThatThrownBy(() -> InvoiceAdjustmentPolicy.requireAmount(invoice, type, null, "bank-ref"))
                    .isInstanceOf(ResponseStatusException.class);
        }
    }

    @Test
    void refundsRequirePaidFundsAndAReferenceWhileReversalsDoNotReduceFees() {
        StudentInvoice invoice = invoice("100.00", "60.00");
        assertThat(require(invoice, AccountAdjustmentType.REFUND, "60.00")).isEqualByComparingTo("60.00");
        assertThat(require(invoice, AccountAdjustmentType.PAYMENT_REVERSAL, "60.00")).isEqualByComparingTo("60.00");
        for (AccountAdjustmentType type : List.of(AccountAdjustmentType.REFUND, AccountAdjustmentType.PAYMENT_REVERSAL)) {
            assertThatThrownBy(() -> require(invoice, type, "60.01"))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("payment available");
        }
        assertThatThrownBy(() -> InvoiceAdjustmentPolicy.requireAmount(invoice, AccountAdjustmentType.REFUND,
                new BigDecimal("10.00"), " "))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("bank or payment-provider reference");
        invoice.setStatus(InvoiceStatus.CANCELLED);
        for (AccountAdjustmentType type : AccountAdjustmentType.values()) {
            assertThatThrownBy(() -> require(invoice, type, "0.01"))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("cancelled");
        }
    }

    private BigDecimal require(StudentInvoice invoice, AccountAdjustmentType type, String amount) {
        return InvoiceAdjustmentPolicy.requireAmount(invoice, type, new BigDecimal(amount), "bank-ref");
    }

    private StudentInvoice invoice(String chargeAmount, String paidAmount) {
        StudentInvoice invoice = new StudentInvoice();
        invoice.setDueDate(LocalDate.of(2099, 1, 1));
        InvoiceLineItem charge = new InvoiceLineItem();
        charge.setType(LineItemType.CHARGE);
        charge.setAmount(new BigDecimal(chargeAmount));
        invoice.addLineItem(charge);
        new PaymentLedgerService().recordSuccessfulPayment(invoice, new BigDecimal(paidAmount), "AUDIT", "test", Instant.now());
        return invoice;
    }
}
