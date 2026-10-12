package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentMethod;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.ReviewManualPaymentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.ManualPaymentService;
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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

class ManualPaymentsControllerTest {
    private ManualPaymentService manualPaymentService;
    private SessionAuthService sessionAuthService;
    private ManualPaymentsController controller;

    @BeforeEach
    void setUp() {
        manualPaymentService = mock(ManualPaymentService.class);
        sessionAuthService = mock(SessionAuthService.class);
        controller = new ManualPaymentsController(manualPaymentService, sessionAuthService);
    }

    @Test
    void submissionIsRestrictedToTheAuthenticatedStudent() {
        UUID studentId = UUID.randomUUID();
        UUID invoiceId = UUID.randomUUID();
        MockMultipartFile receipt = receipt();

        controller.submit(
                studentId,
                invoiceId,
                "120.50",
                ManualPaymentMethod.CASH,
                "Student reference",
                receipt,
                "Bearer student-token"
        );

        verify(sessionAuthService).requireStudentSelf("Bearer student-token", studentId);
        verify(manualPaymentService).submit(
                studentId,
                invoiceId,
                ManualPaymentMethod.CASH,
                new BigDecimal("120.50"),
                "Student reference",
                receipt
        );
    }

    @Test
    void malformedAmountReturnsBadRequestBeforeSubmission() {
        UUID studentId = UUID.randomUUID();

        assertThatThrownBy(() -> controller.submit(
                studentId,
                UUID.randomUUID(),
                "not-an-amount",
                ManualPaymentMethod.BANK_TRANSFER,
                null,
                receipt(),
                "Bearer student-token"
        ))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(BAD_REQUEST));

        verify(sessionAuthService).requireStudentSelf("Bearer student-token", studentId);
        verify(manualPaymentService, never()).submit(any(), any(), any(), any(), any(), any());
    }

    @Test
    void reviewRequiresAnAdministrator() {
        UUID adminId = UUID.randomUUID();
        UUID submissionId = UUID.randomUUID();
        ReviewManualPaymentRequest request = new ReviewManualPaymentRequest(
                ManualPaymentStatus.APPROVED,
                "Matched in bank account"
        );
        when(sessionAuthService.requireAdmin("Bearer admin-token")).thenReturn(adminId);

        controller.review(submissionId, request, "Bearer admin-token");

        verify(sessionAuthService).requireAdmin("Bearer admin-token");
        verify(manualPaymentService).review(adminId, submissionId, request);
    }

    private MockMultipartFile receipt() {
        return new MockMultipartFile(
                "receipt",
                "receipt.pdf",
                "application/pdf",
                "%PDF-1.7 demo".getBytes()
        );
    }
}
