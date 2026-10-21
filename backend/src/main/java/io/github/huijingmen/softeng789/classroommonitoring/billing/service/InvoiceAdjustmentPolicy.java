package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AccountAdjustmentType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import java.math.BigDecimal;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** Validates adjustment inputs against the locked invoice before any ledger or credit writes. */
final class InvoiceAdjustmentPolicy {
    private InvoiceAdjustmentPolicy() { }

    static BigDecimal requireAmount(StudentInvoice invoice, AccountAdjustmentType type,
            BigDecimal input, String externalReference) {
        BigDecimal amount = InvoiceInputMoney.require(input);
        if (type == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Choose an adjustment type.");
        }
        if (invoice.getStatus() == InvoiceStatus.CANCELLED) {
            throw new ResponseStatusException(BAD_REQUEST, "A cancelled payment request cannot be adjusted.");
        }
        if (type == AccountAdjustmentType.CREDIT && amount.compareTo(InvoiceAmounts.balance(invoice)) > 0) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Credit cannot exceed the current amount due. For money already paid, record an external refund instead.");
        }
        if ((type == AccountAdjustmentType.REFUND || type == AccountAdjustmentType.PAYMENT_REVERSAL)
                && amount.compareTo(InvoiceAmounts.payments(invoice)) > 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Amount cannot exceed the payment available to reverse.");
        }
        BigDecimal netCharges = InvoiceAmounts.charges(invoice).subtract(InvoiceAmounts.credits(invoice));
        if (type == AccountAdjustmentType.REFUND && feeCredit(invoice, type, amount).compareTo(netCharges) > 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Refund cannot exceed the remaining invoiced charges.");
        }
        if (type == AccountAdjustmentType.REFUND && (externalReference == null || externalReference.isBlank())) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Enter the bank or payment-provider reference for the refund already completed outside ClassLens.");
        }
        return amount;
    }

    /** Return excess funds first; only the remaining refund cancels previously invoiced fees. */
    static BigDecimal feeCredit(StudentInvoice invoice, AccountAdjustmentType type, BigDecimal amount) {
        return type == AccountAdjustmentType.REFUND
                ? amount.subtract(InvoiceAmounts.overpayment(invoice)).max(BigDecimal.ZERO)
                : amount;
    }
}
