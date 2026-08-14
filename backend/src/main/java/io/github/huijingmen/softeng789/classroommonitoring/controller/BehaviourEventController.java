package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ApiMessage;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/behaviour-events")
public class BehaviourEventController {
    @GetMapping
    public ApiMessage listBehaviourEvents() {
        return ApiMessage.placeholder("Behaviour events");
    }
}
