package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.AccountAdjustmentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.InvoiceAccountResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.ManageSessionPackageRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.OperationsDashboardResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.SessionPackageOperationResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.BillingAccountService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.UUID;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/payments")
public class BillingOperationsController {
    private final BillingAccountService billingAccountService;
    private final SessionAuthService sessionAuthService;

    public BillingOperationsController(
            BillingAccountService billingAccountService,
            SessionAuthService sessionAuthService
    ) {
        this.billingAccountService = billingAccountService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping("/operations")
    public OperationsDashboardResponse operations(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        LocalDate today = LocalDate.now(ZoneId.of("Pacific/Auckland"));
        return billingAccountService.operationsDashboard(
                from == null ? today.withDayOfYear(1) : from,
                to == null ? today : to
        );
    }

    @GetMapping("/{invoiceId}/account")
    public InvoiceAccountResponse account(
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return billingAccountService.account(invoiceId);
    }

    @PostMapping("/{invoiceId}/adjustments")
    public InvoiceAccountResponse adjust(
            @PathVariable UUID invoiceId,
            @Valid @RequestBody AccountAdjustmentRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID adminId = sessionAuthService.requireAdmin(authorization);
        return billingAccountService.adjust(adminId, invoiceId, request);
    }

    @PutMapping("/session-packages/{packageId}/lifecycle")
    public SessionPackageOperationResponse managePackage(
            @PathVariable UUID packageId,
            @Valid @RequestBody ManageSessionPackageRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID adminId = sessionAuthService.requireAdmin(authorization);
        return billingAccountService.managePackage(adminId, packageId, request);
    }
}
