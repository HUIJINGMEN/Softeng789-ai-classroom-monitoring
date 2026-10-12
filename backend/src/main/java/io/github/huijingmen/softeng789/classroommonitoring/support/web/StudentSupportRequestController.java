package io.github.huijingmen.softeng789.classroommonitoring.support.web;

import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.AdminStudentSupportRequestsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.CreateStudentSupportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.ReviewStudentSupportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.StudentSupportRequestResponse;
import io.github.huijingmen.softeng789.classroommonitoring.support.service.StudentSupportRequestService;
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
public class StudentSupportRequestController {
    private final StudentSupportRequestService requestService;
    private final SessionAuthService sessionAuthService;

    public StudentSupportRequestController(
            StudentSupportRequestService requestService,
            SessionAuthService sessionAuthService
    ) {
        this.requestService = requestService;
        this.sessionAuthService = sessionAuthService;
    }

    @PostMapping("/students/{studentId}/support-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public StudentSupportRequestResponse submit(
            @PathVariable UUID studentId,
            @Valid @RequestBody CreateStudentSupportRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return requestService.submit(studentId, request);
    }

    @GetMapping("/students/{studentId}/support-requests")
    public List<StudentSupportRequestResponse> studentRequests(
            @PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return requestService.studentRequests(studentId);
    }

    @DeleteMapping("/students/{studentId}/support-requests/{requestId}")
    public StudentSupportRequestResponse cancel(
            @PathVariable UUID studentId,
            @PathVariable UUID requestId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return requestService.cancel(studentId, requestId);
    }

    @GetMapping("/admin/support-requests")
    public AdminStudentSupportRequestsResponse adminRequests(
            @RequestParam(required = false) StudentRequestStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return requestService.adminRequests(status, page, size);
    }

    @PutMapping("/admin/support-requests/{requestId}")
    public StudentSupportRequestResponse review(
            @PathVariable UUID requestId,
            @Valid @RequestBody ReviewStudentSupportRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return requestService.review(sessionAuthService.requireAdmin(authorization), requestId, request);
    }
}
