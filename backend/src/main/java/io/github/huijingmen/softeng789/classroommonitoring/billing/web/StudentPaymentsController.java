package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CheckoutResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.StudentStatementResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.PaymentService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Student-facing payment statement and checkout endpoints. */
@RestController
@RequestMapping("/api/students/{studentId}/payments")
public class StudentPaymentsController {
    private final PaymentService paymentService;
    private final SessionAuthService sessionAuthService;

    public StudentPaymentsController(PaymentService paymentService, SessionAuthService sessionAuthService) {
        this.paymentService = paymentService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public StudentStatementResponse statement(
            @PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return paymentService.statement(studentId);
    }

    @PostMapping("/{invoiceId}/checkout")
    public CheckoutResponse checkout(
            @PathVariable UUID studentId,
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return paymentService.checkout(studentId, invoiceId);
    }
}
