package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Centralises invoice arithmetic so statement, checkout and administration flows use the
 * same rounding and balance rules.
 */
public final class InvoiceAmounts {
    private InvoiceAmounts() {
    }

    public static BigDecimal charges(StudentInvoice invoice) {
        return totalLineItems(invoice, LineItemType.CHARGE);
    }

    public static BigDecimal credits(StudentInvoice invoice) {
        return totalLineItems(invoice, LineItemType.CREDIT);
    }

    public static BigDecimal payments(StudentInvoice invoice) {
        return money(invoice.getTransactions().stream()
                .filter(transaction -> transaction.getStatus() == PaymentStatus.SUCCEEDED)
                .map(PaymentTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    public static BigDecimal balance(StudentInvoice invoice) {
        return money(charges(invoice)
                .subtract(credits(invoice))
                .subtract(payments(invoice))
                .max(BigDecimal.ZERO));
    }

    public static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal totalLineItems(StudentInvoice invoice, LineItemType type) {
        return money(invoice.getLineItems().stream()
                .filter(item -> item.getType() == type)
                .map(InvoiceLineItem::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
    }
}
