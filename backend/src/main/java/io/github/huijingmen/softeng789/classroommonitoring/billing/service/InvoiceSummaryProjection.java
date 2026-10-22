package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository.FinancialState;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import org.springframework.web.server.ResponseStatusException;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** Totals clamp debt per invoice, so one overpayment cannot cancel another invoice's debt. */
final class InvoiceSummaryProjection {
    private InvoiceSummaryProjection() { }

    static AdminPaymentSummaryResponse from(List<FinancialState> rows, LocalDate today) {
        BigDecimal outstanding = BigDecimal.ZERO;
        BigDecimal collected = BigDecimal.ZERO;
        BigDecimal issued = BigDecimal.ZERO;
        long drafts = 0;
        long overdue = 0;
        long open = 0;
        for (FinancialState row : rows) {
            if (!InvoiceDraftFactory.CURRENCY.equals(row.getCurrency())) {
                throw new ResponseStatusException(BAD_REQUEST, "Invoice totals cannot combine different currencies.");
            }
            var debt = InvoiceDebtProjection.from(row.getLifecycleStatus(), row.getDueDate(),
                    row.getNetCharges(), row.getNetPayments(), today);
            InvoiceStatus status = debt.status();
            if (status == InvoiceStatus.DRAFT) {
                drafts++;
                continue;
            }
            collected = collected.add(row.getNetPayments());
            if (status != InvoiceStatus.CANCELLED) issued = issued.add(row.getNetCharges().max(BigDecimal.ZERO));
            if (status.isOpen()) {
                open++;
                outstanding = outstanding.add(debt.outstanding());
            }
            if (status == InvoiceStatus.OVERDUE) overdue++;
        }
        int collectionRate = issued.signum() > 0
                ? issued.subtract(outstanding).max(BigDecimal.ZERO).multiply(BigDecimal.valueOf(100))
                    .divide(issued, 0, RoundingMode.HALF_UP).min(BigDecimal.valueOf(100)).intValue()
                : 0;
        return new AdminPaymentSummaryResponse(money(outstanding), money(collected.max(BigDecimal.ZERO)), money(issued), collectionRate,
                drafts, overdue, open, InvoiceDraftFactory.CURRENCY);
    }
}
