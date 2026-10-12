package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SessionPackageUsageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.UpdateAttendanceBillingRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.SessionPackageService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Administrator corrections for attendance-backed session package usage. */
@RestController
@RequestMapping("/api/admin/payments/session-packages")
public class SessionPackageBillingController {
    private final SessionPackageService sessionPackageService;
    private final SessionAuthService sessionAuthService;

    public SessionPackageBillingController(
            SessionPackageService sessionPackageService,
            SessionAuthService sessionAuthService
    ) {
        this.sessionPackageService = sessionPackageService;
        this.sessionAuthService = sessionAuthService;
    }

    @PutMapping("/{packageId}/attendance/{attendanceRecordId}")
    public SessionPackageUsageResponse updateAttendance(
            @PathVariable UUID packageId,
            @PathVariable UUID attendanceRecordId,
            @Valid @RequestBody UpdateAttendanceBillingRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID adminId = sessionAuthService.requireAdmin(authorization);
        return sessionPackageService.updateAttendanceDecision(adminId, packageId, attendanceRecordId, request);
    }
}
