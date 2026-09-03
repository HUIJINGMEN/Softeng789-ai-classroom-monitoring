package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PublicClassSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.AdminClassService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only class listing for any signed-in staff member, used by the session-scheduling dropdown. */
@RestController
@RequestMapping("/api/classes")
public class ClassController {
    private final AdminClassService adminClassService;
    private final SessionAuthService sessionAuthService;

    public ClassController(AdminClassService adminClassService, SessionAuthService sessionAuthService) {
        this.adminClassService = adminClassService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public List<ClassSummaryResponse> listActiveClasses(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireTeacher(authorization);
        return adminClassService.listActiveClassesForScheduling();
    }

    // Deliberately unauthenticated — the student self-registration page needs to show which
    // classes exist before an account (and therefore a bearer token) exists.
    @GetMapping("/public")
    public List<PublicClassSummaryResponse> listPublicClasses() {
        return adminClassService.listActiveClassesForRegistration();
    }
}
