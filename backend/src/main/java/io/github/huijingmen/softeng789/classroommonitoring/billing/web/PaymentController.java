package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CheckoutResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoiceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoicesResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.StudentStatementResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.PaymentService;
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

@RestController
@RequestMapping("/api")
public class PaymentController {
    private final PaymentService paymentService;
    private final SessionAuthService sessionAuthService;

    public PaymentController(PaymentService paymentService, SessionAuthService sessionAuthService) {
        this.paymentService = paymentService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping("/students/{studentId}/payments")
    public StudentStatementResponse studentStatement(
            @PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return paymentService.statement(studentId);
    }

    @PostMapping("/students/{studentId}/payments/{invoiceId}/checkout")
    public CheckoutResponse checkout(
            @PathVariable UUID studentId,
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return paymentService.checkout(studentId, invoiceId);
    }

    @GetMapping("/admin/payments")
    public AdminPaymentsResponse adminPayments(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) InvoiceStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return paymentService.adminList(query, status, page, size);
    }

    @PostMapping("/admin/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateInvoicesResponse createPaymentRequests(
            @Valid @RequestBody CreateInvoiceRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID adminId = sessionAuthService.requireAdmin(authorization);
        return paymentService.create(adminId, request);
    }
}
