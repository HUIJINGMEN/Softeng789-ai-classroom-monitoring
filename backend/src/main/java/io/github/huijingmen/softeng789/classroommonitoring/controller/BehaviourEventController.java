package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ApiMessage;
import io.github.huijingmen.softeng789.classroommonitoring.service.AuthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/behaviour-events")
public class BehaviourEventController {
    private final AuthService authService;

    public BehaviourEventController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping
    public ApiMessage listBehaviourEvents(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        authService.requireTeacher(authorization);
        return ApiMessage.placeholder("Behaviour events");
    }
}
