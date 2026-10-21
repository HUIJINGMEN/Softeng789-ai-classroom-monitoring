package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

/** Database-side counterpart of InvoiceStatusPolicy for filtering BEFORE pagination.
 * Correlated totals avoid line-item x transaction fan-out. Integration tests enforce policy parity.
 * Queries using these fragments name their invoice alias "invoice" and bind the school date "today".
 */
public final class InvoiceStatusQuery {
    private InvoiceStatusQuery() { }
    private static final String STATUS = "io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus.";
    public static final String NET_CHARGES = """
            (select coalesce(sum(case when item.type =
              io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType.CHARGE
              then item.amount else -item.amount end), 0)
            from InvoiceLineItem item where item.invoice = invoice)
            """;
    public static final String NET_PAYMENTS = """
            (select coalesce(sum(case when payment.status =
              io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus.SUCCEEDED
              then payment.amount when payment.status =
              io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus.REFUNDED
              then -payment.amount else 0 end), 0)
            from PaymentTransaction payment where payment.invoice = invoice)
            """;
    public static final String CURRENT_STATUS = "case when invoice.status in (" + STATUS + "DRAFT, " + STATUS + "CANCELLED) then invoice.status"
            + " when " + NET_CHARGES + " <= greatest(" + NET_PAYMENTS + ", 0) then " + STATUS + "PAID"
            + " when invoice.dueDate < :today then " + STATUS + "OVERDUE"
            + " when " + NET_PAYMENTS + " > 0 then " + STATUS + "PARTIALLY_PAID"
            + " else " + STATUS + "PENDING end";
}
