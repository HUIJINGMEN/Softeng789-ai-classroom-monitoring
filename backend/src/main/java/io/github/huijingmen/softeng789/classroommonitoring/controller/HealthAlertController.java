package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ConfirmHealthAlertRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.DismissHealthAlertRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthAlertFilter;
import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthAlertResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.HealthAlertService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** AI-detected candidate health/safety events. A TEACHER only ever sees alerts for their own
 *  classes; an ADMIN sees everything — the scoping happens inside HealthAlertService, not here. */
@RestController
@RequestMapping("/api/health-alerts")
public class HealthAlertController {
    private final HealthAlertService healthAlertService;
    private final SessionAuthService sessionAuthService;

    public HealthAlertController(HealthAlertService healthAlertService, SessionAuthService sessionAuthService) {
        this.healthAlertService = healthAlertService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public List<HealthAlertResponse> listAlerts(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) UUID courseOfferingId,
            @RequestParam(required = false) UUID studentId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) Instant dateFrom,
            @RequestParam(required = false) Instant dateTo
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        HealthAlertFilter filter =
                new HealthAlertFilter(courseOfferingId, studentId, status, eventType, source, dateFrom, dateTo);
        return healthAlertService.listAlerts(callerId, filter);
    }

    @GetMapping("/{id}")
    public HealthAlertResponse getAlert(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return healthAlertService.getAlert(id, callerId);
    }

    @PostMapping("/{id}/confirm")
    public HealthAlertResponse confirmAlert(
            @PathVariable UUID id,
            @RequestBody(required = false) ConfirmHealthAlertRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        ConfirmHealthAlertRequest body = request != null ? request : new ConfirmHealthAlertRequest(null, null, null);
        return healthAlertService.confirmAlert(id, callerId, body);
    }

    @PostMapping("/{id}/dismiss")
    public HealthAlertResponse dismissAlert(
            @PathVariable UUID id,
            @RequestBody(required = false) DismissHealthAlertRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        DismissHealthAlertRequest body = request != null ? request : new DismissHealthAlertRequest(null);
        return healthAlertService.dismissAlert(id, callerId, body);
    }
}
