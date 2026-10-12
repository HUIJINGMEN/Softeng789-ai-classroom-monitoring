package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.InvoiceLineItemRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.PaymentTransactionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/** Read-only projections used by the administrator invoice workspace. */
@Service
public class AdminPaymentQueryService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final EnumSet<InvoiceStatus> OPEN_STATUSES = EnumSet.of(
            InvoiceStatus.PENDING,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.OVERDUE
    );

    private final StudentInvoiceRepository invoiceRepository;
    private final InvoiceLineItemRepository lineItemRepository;
    private final PaymentTransactionRepository transactionRepository;
    private final SessionPackageService sessionPackageService;

    public AdminPaymentQueryService(
            StudentInvoiceRepository invoiceRepository,
            InvoiceLineItemRepository lineItemRepository,
            PaymentTransactionRepository transactionRepository,
            SessionPackageService sessionPackageService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.lineItemRepository = lineItemRepository;
        this.transactionRepository = transactionRepository;
        this.sessionPackageService = sessionPackageService;
    }

    @Transactional
    public AdminPaymentsResponse list(String query, InvoiceStatus status, int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid payment page request.");
        }
        invoiceRepository.markOverdue(
                EnumSet.of(InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID),
                InvoiceStatus.OVERDUE,
                BillingDates.today()
        );

        PageRequest pageable = PageRequest.of(page, size, Sort.by(
                Sort.Order.asc("dueDate"),
                Sort.Order.desc("createdAt")
        ));
        Page<StudentInvoice> result = invoiceRepository.search(query == null ? "" : query.trim(), status, pageable);
        PageResponse<AdminPaymentRowResponse> responsePage =
                PageResponse.from(result, PaymentResponseMapper::toAdminRow);
        return new AdminPaymentsResponse(summary(), responsePage);
    }

    @Transactional
    public InvoiceResponse invoice(UUID invoiceId) {
        StudentInvoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment request not found."));
        refreshOverdue(invoice);
        var packages = sessionPackageService.summarizeAllForInvoices(List.of(invoiceId))
                .getOrDefault(invoiceId, List.of());
        return PaymentResponseMapper.toInvoice(invoice, List.of(), packages);
    }

    private AdminPaymentSummaryResponse summary() {
        BigDecimal charges = lineItemRepository.sumAmountByTypeAndInvoiceStatusIn(
                LineItemType.CHARGE,
                OPEN_STATUSES
        );
        BigDecimal credits = lineItemRepository.sumAmountByTypeAndInvoiceStatusIn(
                LineItemType.CREDIT,
                OPEN_STATUSES
        );
        BigDecimal openPayments = transactionRepository.sumAmountByStatusAndInvoiceStatusIn(
                PaymentStatus.SUCCEEDED,
                OPEN_STATUSES
        ).subtract(transactionRepository.sumAmountByStatusAndInvoiceStatusIn(
                PaymentStatus.REFUNDED,
                OPEN_STATUSES
        ));
        BigDecimal outstanding = charges.subtract(credits).subtract(openPayments).max(BigDecimal.ZERO);
        BigDecimal collected = transactionRepository.sumAmountByStatus(PaymentStatus.SUCCEEDED)
                .subtract(transactionRepository.sumAmountByStatus(PaymentStatus.REFUNDED))
                .max(BigDecimal.ZERO);
        return new AdminPaymentSummaryResponse(
                money(outstanding),
                money(collected),
                invoiceRepository.countByStatus(InvoiceStatus.DRAFT),
                invoiceRepository.countByStatus(InvoiceStatus.OVERDUE),
                invoiceRepository.countByStatusIn(OPEN_STATUSES),
                InvoiceDraftFactory.CURRENCY
        );
    }

    private void refreshOverdue(StudentInvoice invoice) {
        if (invoice.getStatus().canBecomeOverdue() && invoice.getDueDate().isBefore(BillingDates.today())) {
            invoice.setStatus(InvoiceStatus.OVERDUE);
            invoiceRepository.save(invoice);
        }
    }
}
