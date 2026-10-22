package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Per-invoice debt, not cash flow: surplus on another invoice never pays this one automatically. */
record InvoiceDebtProjection(InvoiceStatus status, BigDecimal outstanding, BigDecimal overdue) {
    static InvoiceDebtProjection from(StudentInvoice invoice, LocalDate today) {
        return from(invoice.getStatus(), invoice.getDueDate(),
                InvoiceAmounts.charges(invoice).subtract(InvoiceAmounts.credits(invoice)),
                InvoiceAmounts.payments(invoice), today);
    }

    static InvoiceDebtProjection from(InvoiceStatus lifecycle, LocalDate dueDate, BigDecimal netCharges,
            BigDecimal netPayments, LocalDate today) {
        BigDecimal balance = InvoiceAmounts.money(netCharges.subtract(netPayments.max(BigDecimal.ZERO)).max(BigDecimal.ZERO));
        InvoiceStatus current = InvoiceStatusPolicy.resolve(lifecycle, dueDate, balance, netPayments, today);
        BigDecimal outstanding = current.isOpen() ? balance : InvoiceAmounts.money(BigDecimal.ZERO);
        return new InvoiceDebtProjection(current, outstanding,
                current == InvoiceStatus.OVERDUE ? outstanding : InvoiceAmounts.money(BigDecimal.ZERO));
    }
}
