package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.BehaviourEventResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ReviewBehaviourEventRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.BehaviourEventService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Candidate classroom observations. The service applies the same teacher-own-class/admin-global
 * boundary as sessions, students and health alerts before anything reaches the browser. */
@RestController
@RequestMapping("/api/behaviour-events")
public class BehaviourEventController {
    private final BehaviourEventService behaviourEventService;
    private final SessionAuthService sessionAuthService;

    public BehaviourEventController(
            BehaviourEventService behaviourEventService,
            SessionAuthService sessionAuthService
    ) {
        this.behaviourEventService = behaviourEventService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public List<BehaviourEventResponse> listBehaviourEvents(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return behaviourEventService.listEvents(callerId);
    }

    @PatchMapping("/{id}/review")
    public BehaviourEventResponse reviewBehaviourEvent(
            @PathVariable UUID id,
            @RequestBody ReviewBehaviourEventRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return behaviourEventService.reviewEvent(id, callerId, request);
    }
}
