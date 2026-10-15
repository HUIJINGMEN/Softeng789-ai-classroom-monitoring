package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

@RestController
@RequestMapping("/api/class-reports")
public class ClassReportController {
    private final ClassReportService reports;
    private final SessionAuthService auth;
    public ClassReportController(ClassReportService reports, SessionAuthService auth) { this.reports = reports; this.auth = auth; }
    @PostMapping("/prepare")
    public ClassReportModels.View prepare(@Valid @RequestBody ClassReportModels.Scope scope, @RequestHeader("Authorization") String token) {
        return reports.prepare(scope, auth.requireTeacher(token));
    }
    @GetMapping("/{id}")
    public ClassReportModels.View get(@PathVariable UUID id, @RequestHeader("Authorization") String token) {
        return reports.get(id, auth.requireTeacher(token));
    }
    @GetMapping("/history/{courseId}")
    public List<ClassReportModels.View> history(@PathVariable UUID courseId, @RequestHeader("Authorization") String token) {
        return reports.history(courseId, auth.requireTeacher(token));
    }
    @PostMapping("/{id}/sections/{topic}/generate")
    public ClassReportModels.View generate(@PathVariable UUID id, @PathVariable Topic topic, @Valid @RequestBody Revision revision,
            @RequestHeader("Authorization") String token) {
        return reports.generate(id, topic, revision.version(), auth.requireTeacher(token));
    }
    @PutMapping("/{id}/sections/{topic}")
    public ClassReportModels.View save(@PathVariable UUID id, @PathVariable Topic topic, @Valid @RequestBody Edit edit,
            @RequestHeader("Authorization") String token) {
        return reports.save(id, topic, edit, auth.requireTeacher(token));
    }
    @PostMapping("/{id}/finalize")
    public ClassReportModels.View finalizeReport(@PathVariable UUID id, @Valid @RequestBody Revision revision,
            @RequestHeader("Authorization") String token) {
        return reports.finalizeReport(id, revision.version(), auth.requireTeacher(token));
    }
}
