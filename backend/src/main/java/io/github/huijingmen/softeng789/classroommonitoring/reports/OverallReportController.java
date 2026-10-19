package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

@RestController
@RequestMapping("/api/overall-reports")
public class OverallReportController {
    private final OverallReportService reports;
    private final SessionAuthService auth;
    public OverallReportController(OverallReportService reports, SessionAuthService auth) { this.reports = reports; this.auth = auth; }
    @PostMapping("/prepare")
    public OverallReportModels.View prepare(@Valid @RequestBody OverallReportModels.Scope scope, @RequestHeader("Authorization") String token) {
        return reports.prepare(scope, auth.requireAdmin(token));
    }
    @GetMapping("/{id}")
    public OverallReportModels.View get(@PathVariable UUID id, @RequestHeader("Authorization") String token) {
        return reports.get(id, auth.requireAdmin(token));
    }
    @GetMapping("/draft")
    public OverallReportModels.View draft(@Valid @ModelAttribute OverallReportModels.Scope scope,
            @RequestHeader("Authorization") String token) {
        return reports.loadDraft(scope, auth.requireAdmin(token));
    }
    @GetMapping("/history")
    public List<OverallReportModels.View> history(@RequestHeader("Authorization") String token) { return reports.history(auth.requireAdmin(token)); }
    @PostMapping("/{id}/sections/{topic}/generate")
    public OverallReportModels.View generate(@PathVariable UUID id, @PathVariable Topic topic, @Valid @RequestBody Revision revision,
            @RequestHeader("Authorization") String token) {
        return reports.generate(id, topic, revision.version(), auth.requireAdmin(token));
    }
    @PutMapping("/{id}/sections/{topic}")
    public OverallReportModels.View save(@PathVariable UUID id, @PathVariable Topic topic, @Valid @RequestBody Edit edit,
            @RequestHeader("Authorization") String token) {
        return reports.save(id, topic, edit, auth.requireAdmin(token));
    }
    @PostMapping("/{id}/finalize")
    public OverallReportModels.View finalizeReport(@PathVariable UUID id, @Valid @RequestBody OverallReportModels.Finalize revision,
            @RequestHeader("Authorization") String token) {
        return reports.finalizeReport(id, revision, auth.requireAdmin(token));
    }
}
