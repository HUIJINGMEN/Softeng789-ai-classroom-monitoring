package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AccomplishmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateAccomplishmentsRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ReviewAccomplishmentCorrectionRequest;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.CREATED;

@RestController
@RequestMapping("/api/accomplishments")
public class AccomplishmentController {
    private final AccomplishmentService accomplishmentService;
    private final AccomplishmentFeedbackService feedbackService;
    private final SessionAuthService sessionAuthService;

    public AccomplishmentController(
            AccomplishmentService accomplishmentService,
            AccomplishmentFeedbackService feedbackService,
            SessionAuthService sessionAuthService
    ) {
        this.accomplishmentService = accomplishmentService;
        this.feedbackService = feedbackService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public List<AccomplishmentResponse> list(
            @RequestParam(required = false) UUID studentId,
            @RequestParam(required = false) UUID courseOfferingId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return accomplishmentService.list(studentId, courseOfferingId, callerId);
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public List<AccomplishmentResponse> create(
            @Valid @RequestBody CreateAccomplishmentsRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return accomplishmentService.create(request, callerId);
    }

    @PostMapping("/{id}/confirm")
    public AccomplishmentResponse confirm(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return accomplishmentService.confirm(id, callerId);
    }

    @PostMapping("/{id}/revoke")
    public AccomplishmentResponse revoke(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return accomplishmentService.revoke(id, callerId);
    }

    @PostMapping("/{id}/correction-request/review")
    public AccomplishmentResponse reviewCorrection(
            @PathVariable UUID id,
            @Valid @RequestBody ReviewAccomplishmentCorrectionRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return feedbackService.reviewCorrection(id, request, callerId);
    }
}
