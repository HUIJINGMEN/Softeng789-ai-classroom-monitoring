package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.FeedbackSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.FeedbackSummaryService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class StudentFeedbackSummaryController {
    private final FeedbackSummaryService feedbackSummaryService;
    private final SessionAuthService sessionAuthService;

    public StudentFeedbackSummaryController(
            FeedbackSummaryService feedbackSummaryService,
            SessionAuthService sessionAuthService
    ) {
        this.feedbackSummaryService = feedbackSummaryService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping("/api/students/{studentId}/feedback-summaries")
    public List<FeedbackSummaryResponse> listPublished(
            @PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return feedbackSummaryService.listPublishedForStudent(studentId);
    }
}
