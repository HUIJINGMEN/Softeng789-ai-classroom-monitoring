package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ApiMessage;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/behaviour-events")
public class BehaviourEventController {
    private final SessionAuthService sessionAuthService;

    public BehaviourEventController(SessionAuthService sessionAuthService) {
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public ApiMessage listBehaviourEvents(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireTeacher(authorization);
        return ApiMessage.placeholder("Behaviour events");
    }
}
