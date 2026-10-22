package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/** Read-only projections used by the administrator invoice workspace. */
@Service
public class AdminPaymentQueryService {
    private static final int MAX_PAGE_SIZE = 100;
    private final StudentInvoiceRepository invoiceRepository;
    private final SessionPackageService sessionPackageService;

    public AdminPaymentQueryService(
            StudentInvoiceRepository invoiceRepository,
            SessionPackageService sessionPackageService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.sessionPackageService = sessionPackageService;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public AdminPaymentsResponse list(String query, InvoiceStatus status, int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid payment page request.");
        }
        PageRequest pageable = PageRequest.of(page, size, Sort.by(
                Sort.Order.asc("dueDate"),
                Sort.Order.desc("createdAt")
        ));
        LocalDate today = BillingDates.today();
        Page<StudentInvoice> result = invoiceRepository.search(query == null ? "" : query.trim(), status, today, pageable);
        PageResponse<AdminPaymentRowResponse> responsePage =
                PageResponse.from(result, invoice -> PaymentResponseMapper.toAdminRow(invoice, today));
        return new AdminPaymentsResponse(summary(today), responsePage);
    }

    @Transactional
    public InvoiceResponse invoice(UUID invoiceId) {
        StudentInvoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payment request not found."));
        var packages = sessionPackageService.summarizeAllForInvoices(List.of(invoiceId))
                .getOrDefault(invoiceId, List.of());
        return PaymentResponseMapper.toInvoice(invoice, List.of(), packages);
    }

    private AdminPaymentSummaryResponse summary(LocalDate today) {
        return InvoiceSummaryProjection.from(invoiceRepository.financialStates(), today);
    }
}
