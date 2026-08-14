package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {
    @GetMapping("/health")
    public HealthResponse health() {
        return new HealthResponse("ok", "backend");
    }
}
