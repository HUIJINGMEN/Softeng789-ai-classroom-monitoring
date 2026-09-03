package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateHealthIncidentReportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthIncidentReportFilter;
import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthIncidentReportResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.TeacherClassOptionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.HealthIncidentReportService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.CREATED;

/** Formal health/safety records — reached either by confirming a HealthAlert or by a teacher
 *  reporting one directly. Same TEACHER-vs-ADMIN scoping as HealthAlertController. */
@RestController
@RequestMapping("/api/health-incidents")
public class HealthIncidentReportController {
    private final HealthIncidentReportService healthIncidentReportService;
    private final SessionAuthService sessionAuthService;

    public HealthIncidentReportController(
            HealthIncidentReportService healthIncidentReportService,
            SessionAuthService sessionAuthService
    ) {
        this.healthIncidentReportService = healthIncidentReportService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public List<HealthIncidentReportResponse> listReports(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) UUID courseOfferingId,
            @RequestParam(required = false) UUID studentId,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String incidentType,
            @RequestParam(required = false) Instant dateFrom,
            @RequestParam(required = false) Instant dateTo
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        HealthIncidentReportFilter filter =
                new HealthIncidentReportFilter(courseOfferingId, studentId, source, incidentType, dateFrom, dateTo);
        return healthIncidentReportService.listReports(callerId, filter);
    }

    @GetMapping("/{id}")
    public HealthIncidentReportResponse getReport(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return healthIncidentReportService.getReport(id, callerId);
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public HealthIncidentReportResponse createReport(
            @Valid @RequestBody CreateHealthIncidentReportRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return healthIncidentReportService.createManualReport(request, callerId);
    }

    @GetMapping("/my-classes")
    public List<TeacherClassOptionResponse> listMyClasses(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return healthIncidentReportService.listMyClasses(callerId);
    }
}
