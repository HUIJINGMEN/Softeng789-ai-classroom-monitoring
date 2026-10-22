package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Published financial status is derived evidence, not an independently trusted cached label. */
public final class InvoiceStatusPolicy {
    private InvoiceStatusPolicy() { }

    public static InvoiceStatus current(StudentInvoice invoice) {
        return current(invoice, BillingDates.today());
    }

    public static InvoiceStatus current(StudentInvoice invoice, LocalDate today) {
        if (invoice.getStatus() == InvoiceStatus.DRAFT || invoice.getStatus() == InvoiceStatus.CANCELLED) {
            return invoice.getStatus();
        }
        return resolve(invoice.getStatus(), invoice.getDueDate(), InvoiceAmounts.balance(invoice),
                InvoiceAmounts.payments(invoice), today);
    }

    /** An attention flag uses the same derived financial status as the displayed row. */
    public static boolean needsPaymentAction(InvoiceStatus status) {
        return status == null || status == InvoiceStatus.DRAFT || status.isOpen();
    }

    public static InvoiceStatus resolve(InvoiceStatus lifecycle, LocalDate dueDate, BigDecimal balance,
            BigDecimal netPayments, LocalDate today) {
        if (lifecycle == InvoiceStatus.DRAFT || lifecycle == InvoiceStatus.CANCELLED) return lifecycle;
        if (balance.signum() <= 0) return InvoiceStatus.PAID;
        if (dueDate.isBefore(today)) return InvoiceStatus.OVERDUE;
        return netPayments.signum() > 0 ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.PENDING;
    }
}
