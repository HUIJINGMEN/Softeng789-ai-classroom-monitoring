package io.github.huijingmen.softeng789.classroommonitoring.reports;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** Read-only, scope-exact queue. Listing never creates drafts or invokes inference. */
@Service
public class StudentReportWorkspace {
    public record Request(@NotNull @Size(max = 100) List<@NotNull @Valid Scope> scopes) { }
    public record Saved(UUID id, LocalDate dateFrom, LocalDate dateTo, List<UUID> courseOfferingIds,
                        List<String> courseLabels, int sections, long drafted, long reviewed,
                        boolean stale, Instant createdAt, Instant publishedAt) { }
    public record Row(UUID studentId, Saved draft, Saved published, Saved otherDraft) { }
    private final StudentReportRepository reports;
    private final StudentReportEvidence evidence;
    private final ObjectMapper json;

    public StudentReportWorkspace(StudentReportRepository reports, StudentReportEvidence evidence, ObjectMapper json) {
        this.reports = reports; this.evidence = evidence; this.json = json;
    }

    @Transactional(readOnly = true)
    public List<Row> list(Request request, UUID caller) {
        var scopes = request.scopes();
        for (Scope scope : scopes) {
            if (scope.dateTo().isBefore(scope.dateFrom()))
                throw new ResponseStatusException(BAD_REQUEST, "Choose a valid reporting period.");
            evidence.authorize(scope.studentId(), scope.courseOfferingIds(), caller);
        }
        if (scopes.isEmpty()) return List.of();
        var studentIds = scopes.stream().map(Scope::studentId).distinct().toList();
        var keys = scopes.stream().map(StudentReportWorkspace::key).distinct().toList();
        var matching = reports.findWorkspaceReports(studentIds, keys, caller);
        var recent = reports.findLatestWorkspaceDrafts(studentIds, caller);
        return scopes.stream().map(scope -> {
            var exact = matching.stream().filter(r -> r.getStudentId().equals(scope.studentId())
                    && r.getScopeKey().equals(key(scope))).toList();
            var draft = exact.stream().filter(r -> r.getPublishedAt() == null).findFirst().map(this::summary).orElse(null);
            var published = exact.stream().filter(r -> r.getPublishedAt() != null).findFirst().map(this::summary).orElse(null);
            var other = recent.stream().filter(r -> r.getStudentId().equals(scope.studentId())
                    && !r.getScopeKey().equals(key(scope))).map(this::summary)
                    // Do not reveal a previous draft that includes a class outside this authorized scope.
                    .filter(r -> scope.courseOfferingIds().containsAll(r.courseOfferingIds())).findFirst().orElse(null);
            return new Row(scope.studentId(), draft, published, other);
        }).toList();
    }

    static String key(Scope scope) {
        return ReportEvidence.fingerprint(scope.dateFrom() + ":" + scope.dateTo() + ":"
                + scope.courseOfferingIds().stream().distinct().sorted().toList());
    }

    private Saved summary(StudentReport report) {
        var doc = ReportDocumentJson.read(json, report.getDocument(), Document.class, "Cannot read saved report");
        var sections = doc.sections();
        return new Saved(report.getId(), doc.dateFrom(), doc.dateTo(), doc.courseOfferingIds(), doc.courseLabels(),
                sections.size(), sections.stream().filter(s -> !s.text().isBlank()).count(),
                sections.stream().filter(s -> s.reviewed() && !s.stale() && !s.text().isBlank()).count(),
                sections.stream().anyMatch(Section::stale), report.getCreatedAt(), report.getPublishedAt());
    }
}
