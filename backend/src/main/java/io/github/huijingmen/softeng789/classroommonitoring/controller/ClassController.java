package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PublicClassSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.AdminClassService;
import io.github.huijingmen.softeng789.classroommonitoring.service.ClassRosterService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only class listing for any signed-in staff member — used by the session-scheduling
 *  dropdown and the teacher-facing "Classes" page, scoped to the caller's own classes unless
 *  they're an admin. */
@RestController
@RequestMapping("/api/classes")
public class ClassController {
    private final AdminClassService adminClassService;
    private final ClassRosterService classRosterService;
    private final SessionAuthService sessionAuthService;

    public ClassController(
            AdminClassService adminClassService,
            ClassRosterService classRosterService,
            SessionAuthService sessionAuthService
    ) {
        this.adminClassService = adminClassService;
        this.classRosterService = classRosterService;
        this.sessionAuthService = sessionAuthService;
    }

    @GetMapping
    public List<ClassSummaryResponse> listActiveClasses(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return adminClassService.listActiveClassesForScheduling(callerId);
    }

    @GetMapping("/{id}/students")
    public List<StudentResponse> listStudents(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        UUID callerId = sessionAuthService.requireTeacher(authorization);
        return classRosterService.listStudents(id, callerId);
    }

    // Deliberately unauthenticated — the student self-registration page needs to show which
    // classes exist before an account (and therefore a bearer token) exists.
    @GetMapping("/public")
    public List<PublicClassSummaryResponse> listPublicClasses() {
        return adminClassService.listActiveClassesForRegistration();
    }
}
