package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.FeedbackSummaryDeliveryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FeedbackSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.GenerateFeedbackSummaryRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.GenerateReportInsightRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ReportInsightResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ReviewFeedbackSummaryRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.FeedbackSummaryService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/feedback-summaries")
public class FeedbackSummaryController {
    private final FeedbackSummaryService feedbackSummaryService;
    private final SessionAuthService sessionAuthService;

    public FeedbackSummaryController(
            FeedbackSummaryService feedbackSummaryService,
            SessionAuthService sessionAuthService
    ) {
        this.feedbackSummaryService = feedbackSummaryService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public List<FeedbackSummaryResponse> list(
            @RequestParam(required = false) UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return feedbackSummaryService.listForCaller(callerId, studentId);
    }

    @PostMapping("/generate")
    public FeedbackSummaryResponse generate(
            @Valid @RequestBody GenerateFeedbackSummaryRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return feedbackSummaryService.generate(request, callerId);
    }

    /** Generates a non-published overview for an overall or single-class report. Student-facing
     * summaries use the persisted /generate + /review flow below because they may be emailed or
     * published; internal aggregate reports do not create one record per student. */
    @PostMapping("/insight")
    public ReportInsightResponse insight(
            @Valid @RequestBody GenerateReportInsightRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return feedbackSummaryService.generateInsight(request, callerId);
    }

    @PutMapping("/{id}/review")
    public FeedbackSummaryResponse review(
            @PathVariable UUID id,
            @Valid @RequestBody ReviewFeedbackSummaryRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return feedbackSummaryService.review(id, request, callerId);
    }

    @PostMapping("/{id}/publish")
    public FeedbackSummaryResponse publish(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return feedbackSummaryService.publish(id, callerId);
    }

    @PostMapping("/{id}/email")
    public FeedbackSummaryDeliveryResponse email(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return feedbackSummaryService.email(id, callerId);
    }
}
