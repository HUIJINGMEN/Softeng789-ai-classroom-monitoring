package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentScheduleDtos.StudentScheduleResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.StudentScheduleService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/students/{studentId}/schedule")
public class StudentScheduleController {
    private final StudentScheduleService scheduleService;
    private final SessionAuthService sessionAuthService;

    public StudentScheduleController(
            StudentScheduleService scheduleService,
            SessionAuthService sessionAuthService
    ) {
        this.scheduleService = scheduleService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public StudentScheduleResponse schedule(
            @PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return scheduleService.schedule(studentId);
    }
}
