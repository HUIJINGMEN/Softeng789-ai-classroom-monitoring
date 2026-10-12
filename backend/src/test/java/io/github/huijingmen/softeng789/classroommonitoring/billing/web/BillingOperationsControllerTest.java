package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AccountAdjustmentType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.SessionPackageAction;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.AccountAdjustmentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.ManageSessionPackageRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.BillingAccountService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BillingOperationsControllerTest {
    private BillingAccountService billingAccountService;
    private SessionAuthService sessionAuthService;
    private BillingOperationsController controller;

    @BeforeEach
    void setUp() {
        billingAccountService = mock(BillingAccountService.class);
        sessionAuthService = mock(SessionAuthService.class);
        controller = new BillingOperationsController(billingAccountService, sessionAuthService);
    }

    @Test
    void operationsDashboardRequiresAdminAccess() {
        LocalDate from = LocalDate.of(2026, 1, 1);
        LocalDate to = LocalDate.of(2026, 10, 8);
        controller.operations(from, to, "Bearer admin-token");

        verify(sessionAuthService).requireAdmin("Bearer admin-token");
        verify(billingAccountService).operationsDashboard(from, to);
    }

    @Test
    void financialAdjustmentsCaptureTheAuthenticatedAdministrator() {
        UUID adminId = UUID.randomUUID();
        UUID invoiceId = UUID.randomUUID();
        var request = new AccountAdjustmentRequest(
                AccountAdjustmentType.REFUND, new BigDecimal("25.00"), "Approved withdrawal", "BANK-7712"
        );
        when(sessionAuthService.requireAdmin("Bearer admin-token")).thenReturn(adminId);

        controller.adjust(invoiceId, request, "Bearer admin-token");

        verify(billingAccountService).adjust(adminId, invoiceId, request);
    }

    @Test
    void packageActionsCaptureTheAuthenticatedAdministrator() {
        UUID adminId = UUID.randomUUID();
        UUID packageId = UUID.randomUUID();
        var request = new ManageSessionPackageRequest(
                SessionPackageAction.PAUSE, null, null, "Medical leave"
        );
        when(sessionAuthService.requireAdmin("Bearer admin-token")).thenReturn(adminId);

        controller.managePackage(packageId, request, "Bearer admin-token");

        verify(billingAccountService).managePackage(adminId, packageId, request);
    }
}
