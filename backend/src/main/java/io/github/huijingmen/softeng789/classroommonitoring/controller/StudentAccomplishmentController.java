package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AccomplishmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentAccomplishmentFeedbackRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.AccomplishmentFeedbackService;
import io.github.huijingmen.softeng789.classroommonitoring.service.AccomplishmentService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class StudentAccomplishmentController {
    private final AccomplishmentService accomplishmentService;
    private final AccomplishmentFeedbackService feedbackService;
    private final SessionAuthService sessionAuthService;

    public StudentAccomplishmentController(
            AccomplishmentService accomplishmentService,
            AccomplishmentFeedbackService feedbackService,
            SessionAuthService sessionAuthService
    ) {
        this.accomplishmentService = accomplishmentService;
        this.feedbackService = feedbackService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping("/api/students/{studentId}/accomplishments")
    public List<AccomplishmentResponse> listForStudent(
            @PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return accomplishmentService.listForStudentPortal(studentId);
    }

    @PostMapping("/api/students/{studentId}/accomplishments/{accomplishmentId}/acknowledge")
    public AccomplishmentResponse acknowledge(
            @PathVariable UUID studentId,
            @PathVariable UUID accomplishmentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return feedbackService.acknowledge(accomplishmentId, studentId);
    }

    @PostMapping("/api/students/{studentId}/accomplishments/{accomplishmentId}/correction-requests")
    public AccomplishmentResponse requestCorrection(
            @PathVariable UUID studentId,
            @PathVariable UUID accomplishmentId,
            @Valid @RequestBody StudentAccomplishmentFeedbackRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return feedbackService.requestCorrection(accomplishmentId, studentId, request.message());
    }
}
