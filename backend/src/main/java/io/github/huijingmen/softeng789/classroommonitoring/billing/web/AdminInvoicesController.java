package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentDirectoryFilter;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.ChargeSuggestionPreviewRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.ChargeSuggestionPreviewResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.CreateStudentInvoiceBatchRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.CreateStudentInvoiceBatchResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoiceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoicesResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.StudentPaymentAccountDtos.StudentPaymentDirectoryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.InvoiceSuggestionService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.PaymentService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.StudentPaymentAccountService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Administrator invoice directory, preparation and review entry points. */
@RestController
@RequestMapping("/api/admin")
public class AdminInvoicesController {
    private final PaymentService paymentService;
    private final InvoiceSuggestionService suggestionService;
    private final StudentPaymentAccountService studentPaymentAccountService;
    private final SessionAuthService sessionAuthService;

    public AdminInvoicesController(
            PaymentService paymentService,
            InvoiceSuggestionService suggestionService,
            StudentPaymentAccountService studentPaymentAccountService,
            SessionAuthService sessionAuthService
    ) {
        this.paymentService = paymentService;
        this.suggestionService = suggestionService;
        this.studentPaymentAccountService = studentPaymentAccountService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping("/payments")
    public AdminPaymentsResponse payments(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) InvoiceStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return paymentService.adminList(query, status, page, size);
    }

    @GetMapping("/payment-accounts")
    public StudentPaymentDirectoryResponse paymentAccounts(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) StudentPaymentDirectoryFilter filter,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return studentPaymentAccountService.directory(query, filter, page, size);
    }

    @GetMapping("/payments/{invoiceId}")
    public InvoiceResponse payment(
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return paymentService.adminInvoice(invoiceId);
    }

    @PostMapping("/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateInvoicesResponse create(
            @Valid @RequestBody CreateInvoiceRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return paymentService.create(sessionAuthService.requireAdmin(authorization), request);
    }

    @PostMapping("/payments/charge-preview")
    public ChargeSuggestionPreviewResponse previewCharges(
            @Valid @RequestBody ChargeSuggestionPreviewRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return suggestionService.preview(request);
    }

    @PostMapping("/payments/student-batch")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateStudentInvoiceBatchResponse createStudentBatch(
            @Valid @RequestBody CreateStudentInvoiceBatchRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return paymentService.createStudentBatch(sessionAuthService.requireAdmin(authorization), request);
    }
}
