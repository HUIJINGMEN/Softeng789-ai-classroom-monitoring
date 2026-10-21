package io.github.huijingmen.softeng789.classroommonitoring.reports;

import tools.jackson.databind.json.JsonMapper;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.TeacherScopeSupport;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

@Service
public class ClassReportService {
    private final ClassReportRepository reports;
    private final CourseOfferingRepository courses;
    private final ClassReportEvidence evidence;
    private final ReportNarrativeGateway ai;
    private final TeacherScopeSupport access;
    private final JsonMapper json;
    private final TransactionTemplate transactions;
    public ClassReportService(ClassReportRepository reports, CourseOfferingRepository courses, ClassReportEvidence evidence,
            ReportNarrativeGateway ai, TeacherScopeSupport access, JsonMapper json, PlatformTransactionManager manager) {
        this.reports = reports; this.courses = courses; this.evidence = evidence; this.ai = ai;
        this.access = access; this.json = json; this.transactions = new TransactionTemplate(manager);
    }
    @Transactional
    public ClassReportModels.View prepare(ClassReportModels.Scope scope, UUID caller) {
        evidence.authorize(scope.courseOfferingId(), caller);
        courses.findForReportPreparation(scope.courseOfferingId()).orElseThrow();
        var fresh = evidence.build(scope, caller);
        String key = ReportEvidence.fingerprint(scope.dateFrom() + ":" + scope.dateTo());
        var report = reports.findFirstByCourseOfferingIdAndCreatedByIdAndScopeKeyAndFinalizedAtIsNullOrderByCreatedAtDesc(
                scope.courseOfferingId(), caller, key).orElseGet(() -> {
                    var created = new ClassReport(); created.setCourseOfferingId(scope.courseOfferingId());
                    created.setCreatedById(caller); created.setScopeKey(key); return created;
                });
        if (report.getId() != null) fresh = new ClassReportModels.Document(fresh.dateFrom(), fresh.dateTo(),
                ReportSectionReview.merge(fresh.sections(), read(report).sections()), fresh.snapshot());
        report.setDocument(write(fresh));
        return view(reports.saveAndFlush(report));
    }
    @Transactional(readOnly = true)
    public ClassReportModels.View loadDraft(ClassReportModels.Scope scope, UUID caller) {
        evidence.authorize(scope.courseOfferingId(), caller);
        String key = ReportEvidence.fingerprint(scope.dateFrom() + ":" + scope.dateTo());
        return reports.findFirstByCourseOfferingIdAndCreatedByIdAndScopeKeyAndFinalizedAtIsNullOrderByCreatedAtDesc(
                scope.courseOfferingId(), caller, key).map(this::view).orElse(null);
    }
    public ClassReportModels.View generate(UUID id, Topic topic, long version, UUID caller) {
        var draft = Objects.requireNonNull(transactions.execute(status -> view(editable(id, version, caller))));
        ReportSectionReview.requireCurrentPolicy(draft.document().sections());
        Section old = section(draft.document(), topic);
        boolean factual = topic == Topic.ATTENDANCE || topic == Topic.PAYMENTS || topic == Topic.ABSENCES
                || (topic == Topic.LEARNING && draft.document().snapshot().feedbackCount() == 0);
        var generated = factual ? ClassReportRecordsDraft.generate(draft.document(), old) : ai.generateClass(draft.document(), old);
        String text = generated.summary();
        if (topic == Topic.LEARNING && !"RECORDS".equals(generated.provider()))
            text += "\n\nStrengths\n" + generated.strengths() + "\n\nNext steps\n" + generated.nextSteps();
        Section next = new Section(topic, old.title(), old.evidence(), old.fingerprint(), text, generated.provider(), false, false, null, null);
        return transactions.execute(status -> {
            access.requireCallerForWrite(caller);
            var report = editable(id, version, caller);
            report.setDocument(write(replace(read(report), next)));
            return view(reports.saveAndFlush(report));
        });
    }
    @Transactional
    public ClassReportModels.View save(UUID id, Topic topic, Edit edit, UUID caller) {
        var report = editable(id, edit.version(), caller);
        var document = read(report);
        if (edit.approve()) ReportSectionReview.requireCurrentPolicy(document.sections());
        String reviewer = edit.approve() ? access.requireCaller(caller).getName() : null;
        report.setDocument(write(replace(document, ReportSectionReview.edit(section(document, topic), edit, reviewer))));
        return view(reports.saveAndFlush(report));
    }
    @Transactional
    public ClassReportModels.View finalizeReport(UUID id, long version, UUID caller) {
        var report = require(id, caller);
        if (report.getFinalizedAt() != null && (report.getVersion() == version || report.getVersion() == version + 1))
            return view(report); // Replay a successful finalization after an interrupted response.
        if (!Objects.equals(report.getVersion(), version)) throw new ResponseStatusException(CONFLICT,
                "This class report changed in another window. Reopen it before continuing.");
        if (report.getFinalizedAt() != null) throw new ResponseStatusException(CONFLICT, "Finalized class reports are frozen. Prepare a new draft.");
        ReportSectionReview.requireReviewed(read(report).sections());
        ReportSectionReview.requireCurrentPolicy(read(report).sections());
        report.setFinalizedAt(Instant.now());
        return view(reports.saveAndFlush(report));
    }
    @Transactional(readOnly = true)
    public ClassReportModels.View get(UUID id, UUID caller) {
        return view(require(id, caller));
    }
    @Transactional(readOnly = true)
    public List<ClassReportModels.View> history(UUID courseId, UUID caller) {
        evidence.authorize(courseId, caller);
        return reports.findTop10ByCourseOfferingIdAndFinalizedAtIsNotNullOrderByFinalizedAtDesc(courseId).stream().map(this::view).toList();
    }
    private ClassReport require(UUID id, UUID caller) {
        var report = reports.findById(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class report not found."));
        evidence.authorize(report.getCourseOfferingId(), caller);
        return report;
    }
    private ClassReport editable(UUID id, long version, UUID caller) {
        var report = require(id, caller);
        if (report.getFinalizedAt() != null) throw new ResponseStatusException(CONFLICT, "Finalized class reports are frozen. Prepare a new draft.");
        if (!Objects.equals(report.getVersion(), version)) throw new ResponseStatusException(CONFLICT,
                "This class report changed in another window. Reopen it before continuing.");
        return report;
    }
    private ClassReportModels.View view(ClassReport report) {
        var document = read(report); var course = document.snapshot().course();
        return new ClassReportModels.View(report.getId(), report.getCourseOfferingId(), course.code() + " · " + course.term(),
                report.getVersion(), report.getCreatedAt(), report.getFinalizedAt(), document);
    }
    private Section section(ClassReportModels.Document document, Topic topic) {
        return document.sections().stream().filter(row -> row.topic() == topic).findFirst()
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "This class report has no such section."));
    }
    private ClassReportModels.Document replace(ClassReportModels.Document document, Section next) {
        return new ClassReportModels.Document(document.dateFrom(), document.dateTo(), document.sections().stream()
                .map(row -> row.topic() == next.topic() ? next : row).toList(), document.snapshot());
    }
    private ClassReportModels.Document read(ClassReport report) {
        return ReportDocumentJson.read(json, report.getDocument(), ClassReportModels.Document.class, "Invalid stored class report");
    }
    private String write(ClassReportModels.Document document) {
        return ReportDocumentJson.write(json, document, "Could not store class report");
    }
}
