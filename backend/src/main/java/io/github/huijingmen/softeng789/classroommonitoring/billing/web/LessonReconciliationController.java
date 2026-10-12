package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonCreditDetailResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonDecisionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonReconciliationResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.MakeupOptionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationView;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ScheduleMakeupRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.LessonCreditManagementService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.LessonReconciliationService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.LessonReconciliationExportService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/api/admin/lesson-reconciliation")
public class LessonReconciliationController {
    private final LessonReconciliationService reconciliationService;
    private final LessonCreditManagementService creditService;
    private final SessionAuthService sessionAuthService;
    private final LessonReconciliationExportService exportService;

    public LessonReconciliationController(
            LessonReconciliationService reconciliationService,
            LessonCreditManagementService creditService,
            SessionAuthService sessionAuthService,
            LessonReconciliationExportService exportService
    ) {
        this.reconciliationService = reconciliationService;
        this.creditService = creditService;
        this.sessionAuthService = sessionAuthService;
        this.exportService = exportService;
    }

    @GetMapping
    public LessonReconciliationResponse weekly(
            @RequestParam UUID courseOfferingId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @RequestParam(defaultValue = "WEEK") ReconciliationView view,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "false") boolean exceptionsOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return reconciliationService.reconcile(courseOfferingId, weekStart, view, query, exceptionsOnly, page, size);
    }

    @GetMapping("/credits/{creditId}")
    public LessonCreditDetailResponse detail(
            @PathVariable UUID creditId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return creditService.detail(creditId);
    }

    @PutMapping("/credits/{creditId}/decision")
    public LessonCreditDetailResponse decide(
            @PathVariable UUID creditId,
            @Valid @RequestBody LessonDecisionRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID adminId = sessionAuthService.requireAdmin(authorization);
        return creditService.decide(adminId, creditId, request);
    }

    @GetMapping("/credits/{creditId}/makeup-options")
    public List<MakeupOptionResponse> makeupOptions(
            @PathVariable UUID creditId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return creditService.makeupOptions(creditId);
    }

    @PutMapping("/credits/{creditId}/makeup")
    public LessonCreditDetailResponse scheduleMakeup(
            @PathVariable UUID creditId,
            @Valid @RequestBody ScheduleMakeupRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID adminId = sessionAuthService.requireAdmin(authorization);
        return creditService.scheduleMakeup(adminId, creditId, request);
    }

    @DeleteMapping("/credits/{creditId}/makeup")
    public LessonCreditDetailResponse cancelMakeup(
            @PathVariable UUID creditId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID adminId = sessionAuthService.requireAdmin(authorization);
        return creditService.cancelMakeup(adminId, creditId);
    }

    @GetMapping("/export.xlsx")
    public ResponseEntity<byte[]> excel(
            @RequestParam UUID courseOfferingId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @RequestParam(defaultValue = "WEEK") ReconciliationView view,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "false") boolean exceptionsOnly,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return download(exportService.excel(courseOfferingId, weekStart, view, query, exceptionsOnly));
    }

    @GetMapping("/export.pdf")
    public ResponseEntity<byte[]> pdf(
            @RequestParam UUID courseOfferingId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @RequestParam(defaultValue = "WEEK") ReconciliationView view,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "false") boolean exceptionsOnly,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return download(exportService.pdf(courseOfferingId, weekStart, view, query, exceptionsOnly));
    }

    private ResponseEntity<byte[]> download(LessonReconciliationExportService.ExportDocument document) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(document.contentType()))
                .header("Content-Disposition", ContentDisposition.attachment().filename(document.fileName()).build().toString())
                .body(document.content());
    }
}
