package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.OperationsFinancialResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.PaymentTransactionRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;

/** Period cash flows and current debt are intentionally separate clocks, never invoice creation cohorts. */
@Component
public class BillingOperationsFinancials {
    private final PaymentTransactionRepository transactions;
    public BillingOperationsFinancials(PaymentTransactionRepository transactions) { this.transactions = transactions; }
    record InvoiceMoney(InvoiceCourseAllocation.Result received, InvoiceCourseAllocation.Result outstanding) { }
    record Evidence(OperationsFinancialResponse summary, Map<UUID, InvoiceMoney> invoices) { }

    Evidence load(List<StudentInvoice> invoices, LocalDate from, LocalDate to, Instant asOf) {
        if (invoices.stream().anyMatch(invoice -> !InvoiceDraftFactory.CURRENCY.equals(invoice.getCurrency()))) {
            throw new ResponseStatusException(BAD_REQUEST, "Billing operations cannot combine different currencies.");
        }
        Instant end = to.plusDays(1).atStartOfDay(BillingDates.BUSINESS_ZONE).toInstant();
        if (end.isAfter(asOf)) end = asOf;
        var totals = transactions.totalsInPeriod(from.atStartOfDay(BillingDates.BUSINESS_ZONE).toInstant(),
                end, PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED);
        Map<UUID, BigDecimal> receivedByInvoice = new HashMap<>();
        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal refunds = BigDecimal.ZERO;
        for (var row : totals) {
            gross = gross.add(row.getReceived());
            refunds = refunds.add(row.getRefunded());
            receivedByInvoice.put(row.getInvoiceId(), row.getReceived().subtract(row.getRefunded()));
        }
        BigDecimal outstanding = BigDecimal.ZERO;
        BigDecimal overdue = BigDecimal.ZERO;
        BigDecimal unassignedReceived = BigDecimal.ZERO;
        BigDecimal unassignedOutstanding = BigDecimal.ZERO;
        Map<UUID, InvoiceMoney> byInvoice = new HashMap<>();
        LocalDate today = asOf.atZone(BillingDates.BUSINESS_ZONE).toLocalDate();
        for (var invoice : invoices) {
            var debt = InvoiceDebtProjection.from(invoice, today);
            BigDecimal owed = debt.outstanding();
            outstanding = outstanding.add(owed);
            overdue = overdue.add(debt.overdue());
            var received = InvoiceCourseAllocation.allocate(invoice, receivedByInvoice.getOrDefault(invoice.getId(), BigDecimal.ZERO));
            var allocatedOwed = InvoiceCourseAllocation.allocate(invoice, owed);
            unassignedReceived = unassignedReceived.add(received.unassigned());
            unassignedOutstanding = unassignedOutstanding.add(allocatedOwed.unassigned());
            byInvoice.put(invoice.getId(), new InvoiceMoney(received, allocatedOwed));
        }
        return new Evidence(new OperationsFinancialResponse(InvoiceDraftFactory.CURRENCY, money(gross), money(refunds),
                money(gross.subtract(refunds)), money(outstanding), money(overdue),
                money(unassignedReceived), money(unassignedOutstanding)), Map.copyOf(byInvoice));
    }
}
