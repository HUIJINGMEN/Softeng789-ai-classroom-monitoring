package io.github.huijingmen.softeng789.classroommonitoring.studentoverview;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationView;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import static io.github.huijingmen.softeng789.classroommonitoring.studentoverview.StudentOverviewDtos.*;

@RestController
@RequestMapping("/api/admin/student-overview")
public class StudentOverviewController {
    private final StudentOverviewService service;
    private final SessionAuthService auth;

    public StudentOverviewController(StudentOverviewService service, SessionAuthService auth) {
        this.service = service;
        this.auth = auth;
    }

    @GetMapping
    public Register page(@RequestParam(required = false) UUID courseOfferingId,
                         @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
                         @RequestParam(defaultValue = "WEEK") ReconciliationView view,
                         @RequestParam(defaultValue = "") String query,
                         @RequestParam(defaultValue = "false") boolean exceptionsOnly,
                         @RequestParam(defaultValue = "0") int page,
                         @RequestParam(defaultValue = "6") int size,
                         @RequestHeader(value = "Authorization", required = false) String authorization) {
        auth.requireAdmin(authorization);
        return service.page(courseOfferingId, weekStart, view, query, exceptionsOnly, page, size);
    }

    @GetMapping("/students/{studentId}")
    public StudentRecords student(@PathVariable UUID studentId, @RequestParam UUID courseOfferingId,
                            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
                            @RequestParam(defaultValue = "WEEK") ReconciliationView view,
                            @RequestHeader(value = "Authorization", required = false) String authorization) {
        auth.requireAdmin(authorization);
        return service.student(courseOfferingId, studentId, weekStart, view);
    }
}
