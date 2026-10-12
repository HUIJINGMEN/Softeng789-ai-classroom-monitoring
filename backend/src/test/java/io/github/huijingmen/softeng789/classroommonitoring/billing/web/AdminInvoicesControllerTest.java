package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.service.InvoiceSuggestionService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.PaymentService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.StudentPaymentAccountService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AdminInvoicesControllerTest {
    private PaymentService paymentService;
    private StudentPaymentAccountService studentPaymentAccountService;
    private SessionAuthService sessionAuthService;
    private AdminInvoicesController controller;

    @BeforeEach
    void setUp() {
        paymentService = mock(PaymentService.class);
        studentPaymentAccountService = mock(StudentPaymentAccountService.class);
        sessionAuthService = mock(SessionAuthService.class);
        controller = new AdminInvoicesController(
                paymentService,
                mock(InvoiceSuggestionService.class),
                studentPaymentAccountService,
                sessionAuthService
        );
    }

    @Test
    void invoiceDirectoryRequiresAnAdministrator() {
        controller.payments("", null, 0, 20, "Bearer admin-token");

        verify(sessionAuthService).requireAdmin("Bearer admin-token");
        verify(paymentService).adminList("", null, 0, 20);
    }

    @Test
    void studentAccountDirectoryRequiresAnAdministrator() {
        controller.paymentAccounts("", null, 0, 20, "Bearer admin-token");

        verify(sessionAuthService).requireAdmin("Bearer admin-token");
        verify(studentPaymentAccountService).directory("", null, 0, 20);
    }
}
