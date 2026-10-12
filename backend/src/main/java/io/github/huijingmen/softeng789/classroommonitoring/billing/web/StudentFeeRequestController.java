package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.FeeRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminFeeRequestsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.DeclineFeeRequestRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.FeeRequestResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.QuoteFeeRequestRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.StudentFeeRequestService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class StudentFeeRequestController {
    private final SessionAuthService sessionAuthService;
    private final StudentFeeRequestService feeRequestService;

    public StudentFeeRequestController(
            SessionAuthService sessionAuthService,
            StudentFeeRequestService feeRequestService
    ) {
        this.sessionAuthService = sessionAuthService;
        this.feeRequestService = feeRequestService;
    }

    @PostMapping(value = "/students/{studentId}/fee-requests", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public FeeRequestResponse submit(
            @PathVariable UUID studentId,
            @RequestPart("title") String title,
            @RequestPart("details") String details,
            @RequestPart(value = "evidence", required = false) MultipartFile evidence,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return feeRequestService.submit(studentId, title, details, evidence);
    }

    @GetMapping("/students/{studentId}/fee-requests")
    public List<FeeRequestResponse> studentRequests(
            @PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return feeRequestService.studentRequests(studentId);
    }

    @GetMapping("/admin/payments/fee-requests")
    public AdminFeeRequestsResponse adminRequests(
            @RequestParam(required = false) FeeRequestStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return feeRequestService.adminRequests(status, page, size);
    }

    @PostMapping("/admin/payments/fee-requests/{requestId}/invoice")
    public FeeRequestResponse invoice(
            @PathVariable UUID requestId,
            @Valid @RequestBody QuoteFeeRequestRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return feeRequestService.quote(sessionAuthService.requireAdmin(authorization), requestId, request);
    }

    @PostMapping("/admin/payments/fee-requests/{requestId}/decline")
    public FeeRequestResponse decline(
            @PathVariable UUID requestId,
            @Valid @RequestBody DeclineFeeRequestRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return feeRequestService.decline(sessionAuthService.requireAdmin(authorization), requestId, request);
    }

    @GetMapping("/students/{studentId}/fee-requests/{requestId}/evidence")
    public ResponseEntity<Resource> studentEvidence(
            @PathVariable UUID studentId,
            @PathVariable UUID requestId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return evidenceResponse(feeRequestService.evidenceForStudent(studentId, requestId));
    }

    @GetMapping("/admin/payments/fee-requests/{requestId}/evidence")
    public ResponseEntity<Resource> adminEvidence(
            @PathVariable UUID requestId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return evidenceResponse(feeRequestService.evidenceForAdmin(requestId));
    }

    private ResponseEntity<Resource> evidenceResponse(StudentFeeRequestService.EvidenceDownload evidence) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(evidence.contentType()))
                .header(
                        "Content-Disposition",
                        ContentDisposition.inline().filename(evidence.fileName()).build().toString()
                )
                .body(evidence.resource());
    }
}
