package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

@RestController
@RequestMapping("/api")
public class StudentReportController {
    private final StudentReportService reports;
    private final SessionAuthService auth;
    public StudentReportController(StudentReportService reports, SessionAuthService auth) { this.reports = reports; this.auth = auth; }
    @PostMapping("/student-reports/prepare")
    public View prepare(@Valid @RequestBody Scope scope, @RequestHeader("Authorization") String token) {
        return reports.prepare(scope, auth.requireTeacher(token));
    }
    @GetMapping("/student-reports/{id}")
    public View get(@PathVariable UUID id, @RequestHeader("Authorization") String token) {
        return reports.get(id, auth.requireTeacher(token));
    }
    @PostMapping("/student-reports/{id}/sections/{topic}/generate")
    public View generate(@PathVariable UUID id, @PathVariable Topic topic, @Valid @RequestBody Revision revision,
                         @RequestHeader("Authorization") String token) {
        return reports.generate(id, topic, revision.version(), auth.requireTeacher(token));
    }
    @PutMapping("/student-reports/{id}/sections/{topic}")
    public View save(@PathVariable UUID id, @PathVariable Topic topic, @Valid @RequestBody Edit edit,
                     @RequestHeader("Authorization") String token) {
        return reports.save(id, topic, edit, auth.requireTeacher(token));
    }
    @PostMapping("/student-reports/{id}/publish")
    public View publish(@PathVariable UUID id, @Valid @RequestBody Revision revision, @RequestHeader("Authorization") String token) {
        return reports.publish(id, revision.version(), auth.requireTeacher(token));
    }
    @PostMapping("/student-reports/{id}/email")
    public ReportEmailGateway.DeliveryResult email(@PathVariable UUID id, @Valid @RequestBody Revision revision,
            @RequestHeader("Authorization") String token) {
        return reports.email(id, revision.version(), auth.requireTeacher(token));
    }
    @GetMapping("/students/{studentId}/reports")
    public List<View> published(@PathVariable UUID studentId, @RequestHeader("Authorization") String token) {
        auth.requireStudentSelf(token, studentId);
        return reports.published(studentId);
    }
}
