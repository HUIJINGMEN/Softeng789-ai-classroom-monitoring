package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassFeedbackResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassFeedbackRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.ClassFeedbackService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.CREATED;

@RestController
@RequestMapping("/api/class-feedback")
public class ClassFeedbackController {
    private final ClassFeedbackService classFeedbackService;
    private final SessionAuthService sessionAuthService;

    public ClassFeedbackController(
            ClassFeedbackService classFeedbackService,
            SessionAuthService sessionAuthService
    ) {
        this.classFeedbackService = classFeedbackService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public List<ClassFeedbackResponse> list(
            @RequestParam UUID courseOfferingId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return classFeedbackService.listForClass(courseOfferingId, callerId);
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public ClassFeedbackResponse create(
            @Valid @RequestBody CreateClassFeedbackRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return classFeedbackService.create(request, callerId);
    }
}
