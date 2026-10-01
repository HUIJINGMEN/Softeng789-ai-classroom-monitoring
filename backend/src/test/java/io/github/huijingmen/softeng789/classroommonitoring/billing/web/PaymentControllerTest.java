package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.BankTransferStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.ReviewBankTransferRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.BankTransferService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.PaymentService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;

class PaymentControllerTest {
    private PaymentService paymentService;
    private SessionAuthService sessionAuthService;
    private PaymentController controller;
    private BankTransferService bankTransferService;

    @BeforeEach
    void setUp() {
        paymentService = mock(PaymentService.class);
        sessionAuthService = mock(SessionAuthService.class);
        bankTransferService = mock(BankTransferService.class);
        controller = new PaymentController(paymentService, sessionAuthService, bankTransferService);
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

    @Test
    void bankTransferSubmissionIsRestrictedToTheAuthenticatedStudent() {
        UUID studentId = UUID.randomUUID();
        UUID invoiceId = UUID.randomUUID();
        MockMultipartFile receipt = new MockMultipartFile(
                "receipt", "receipt.pdf", "application/pdf", "%PDF-1.7 demo".getBytes()
        );

        controller.submitBankTransfer(
                studentId,
                invoiceId,
                "120.50",
                "Student reference",
                receipt,
                "Bearer student-token"
        );

        verify(sessionAuthService).requireStudentSelf("Bearer student-token", studentId);
        verify(bankTransferService).submit(
                studentId,
                invoiceId,
                new BigDecimal("120.50"),
                "Student reference",
                receipt
        );
    }

    @Test
    void malformedBankTransferAmountReturnsBadRequestBeforeSubmission() {
        UUID studentId = UUID.randomUUID();
        MockMultipartFile receipt = new MockMultipartFile(
                "receipt", "receipt.pdf", "application/pdf", "%PDF-1.7 demo".getBytes()
        );

        assertThatThrownBy(() -> controller.submitBankTransfer(
                studentId,
                UUID.randomUUID(),
                "not-an-amount",
                null,
                receipt,
                "Bearer student-token"
        ))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> {
                    ResponseStatusException responseError = (ResponseStatusException) error;
                    assertThat(responseError.getStatusCode()).isEqualTo(BAD_REQUEST);
                });

        verify(sessionAuthService).requireStudentSelf("Bearer student-token", studentId);
        verify(bankTransferService, never()).submit(any(), any(), any(), any(), any());
    }

    @Test
    void bankTransferReviewRequiresAnAdministrator() {
        UUID adminId = UUID.randomUUID();
        UUID transferId = UUID.randomUUID();
        var request = new ReviewBankTransferRequest(
                BankTransferStatus.APPROVED,
                "Matched in bank account"
        );
        when(sessionAuthService.requireAdmin("Bearer admin-token")).thenReturn(adminId);

        controller.reviewBankTransfer(transferId, request, "Bearer admin-token");

        verify(sessionAuthService).requireAdmin("Bearer admin-token");
        verify(bankTransferService).review(eq(adminId), eq(transferId), eq(request));
    }
}
