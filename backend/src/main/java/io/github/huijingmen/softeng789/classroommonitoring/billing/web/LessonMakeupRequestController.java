package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonMakeupRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonMakeupRequestDtos.AdminMakeupRequestsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonMakeupRequestDtos.CreateMakeupRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonMakeupRequestDtos.LessonMakeupRequestResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonMakeupRequestDtos.ReviewMakeupRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.MakeupOptionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.LessonMakeupRequestService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class LessonMakeupRequestController {
    private final LessonMakeupRequestService requestService;
    private final SessionAuthService sessionAuthService;

    public LessonMakeupRequestController(
            LessonMakeupRequestService requestService,
            SessionAuthService sessionAuthService
    ) {
        this.requestService = requestService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping("/students/{studentId}/lesson-credits/{creditId}/makeup-options")
    public List<MakeupOptionResponse> options(
            @PathVariable UUID studentId,
            @PathVariable UUID creditId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return requestService.options(studentId, creditId);
    }

    @PostMapping("/students/{studentId}/makeup-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public LessonMakeupRequestResponse submit(
            @PathVariable UUID studentId,
            @Valid @RequestBody CreateMakeupRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return requestService.submit(studentId, request);
    }

    @GetMapping("/students/{studentId}/makeup-requests")
    public List<LessonMakeupRequestResponse> studentRequests(
            @PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return requestService.studentRequests(studentId);
    }

    @DeleteMapping("/students/{studentId}/makeup-requests/{requestId}")
    public LessonMakeupRequestResponse cancel(
            @PathVariable UUID studentId,
            @PathVariable UUID requestId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return requestService.cancel(studentId, requestId);
    }

    @GetMapping("/admin/payments/makeup-requests")
    public AdminMakeupRequestsResponse adminRequests(
            @RequestParam(required = false) LessonMakeupRequestStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return requestService.adminRequests(status, page, size);
    }

    @PutMapping("/admin/payments/makeup-requests/{requestId}")
    public LessonMakeupRequestResponse review(
            @PathVariable UUID requestId,
            @Valid @RequestBody ReviewMakeupRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return requestService.review(sessionAuthService.requireAdmin(authorization), requestId, request);
    }
}
