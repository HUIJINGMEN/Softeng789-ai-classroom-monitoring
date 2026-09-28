package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.service.PaymentService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.http.HttpStatus.FORBIDDEN;

class PaymentControllerTest {
    private PaymentService paymentService;
    private SessionAuthService sessionAuthService;
    private PaymentController controller;

    @BeforeEach
    void setUp() {
        paymentService = mock(PaymentService.class);
        sessionAuthService = mock(SessionAuthService.class);
        controller = new PaymentController(paymentService, sessionAuthService);
    }

    @Test
    void studentStatementIsRestrictedToTheAuthenticatedStudent() {
        UUID studentId = UUID.randomUUID();
        controller.studentStatement(studentId, "Bearer student-token");

        verify(sessionAuthService).requireStudentSelf("Bearer student-token", studentId);
        verify(paymentService).statement(studentId);
    }

    @Test
    void staffCannotBypassTheStudentOnlyPaymentBoundary() {
        UUID studentId = UUID.randomUUID();
        doThrow(new ResponseStatusException(FORBIDDEN, "Student access required."))
                .when(sessionAuthService).requireStudentSelf("Bearer teacher-token", studentId);

        assertThatThrownBy(() -> controller.studentStatement(studentId, "Bearer teacher-token"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Student access required");
        verify(paymentService, never()).statement(studentId);
    }

    @Test
    void paymentDirectoryRequiresAnAdministrator() {
        controller.adminPayments("", null, 0, 20, "Bearer admin-token");

        verify(sessionAuthService).requireAdmin("Bearer admin-token");
        verify(paymentService).adminList("", null, 0, 20);
    }
}
