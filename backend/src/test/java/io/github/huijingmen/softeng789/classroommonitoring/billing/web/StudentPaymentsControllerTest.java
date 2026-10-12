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

class StudentPaymentsControllerTest {
    private PaymentService paymentService;
    private SessionAuthService sessionAuthService;
    private StudentPaymentsController controller;

    @BeforeEach
    void setUp() {
        paymentService = mock(PaymentService.class);
        sessionAuthService = mock(SessionAuthService.class);
        controller = new StudentPaymentsController(paymentService, sessionAuthService);
    }

    @Test
    void statementIsRestrictedToTheAuthenticatedStudent() {
        UUID studentId = UUID.randomUUID();

        controller.statement(studentId, "Bearer student-token");

        verify(sessionAuthService).requireStudentSelf("Bearer student-token", studentId);
        verify(paymentService).statement(studentId);
    }

    @Test
    void staffCannotBypassTheStudentOnlyBoundary() {
        UUID studentId = UUID.randomUUID();
        doThrow(new ResponseStatusException(FORBIDDEN, "Student access required."))
                .when(sessionAuthService).requireStudentSelf("Bearer teacher-token", studentId);

        assertThatThrownBy(() -> controller.statement(studentId, "Bearer teacher-token"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Student access required");
        verify(paymentService, never()).statement(studentId);
    }
}
