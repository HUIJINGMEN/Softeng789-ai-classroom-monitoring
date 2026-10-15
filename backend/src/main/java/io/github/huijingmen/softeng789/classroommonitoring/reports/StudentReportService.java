package io.github.huijingmen.softeng789.classroommonitoring.reports;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway;
import io.github.huijingmen.softeng789.classroommonitoring.service.TeacherScopeSupport;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static org.springframework.http.HttpStatus.*;

@Service
public class StudentReportService {
    private final StudentReportRepository reports;
    private final StudentRepository students;
    private final StudentReportEvidence evidence;
    private final ReportNarrativeGateway ai;
    private final ObjectMapper json;
    private final TeacherScopeSupport access;
    private final StudentReportEmailService email;
    private final TransactionTemplate transactions;
    public StudentReportService(StudentReportRepository reports, StudentRepository students, StudentReportEvidence evidence,
            ReportNarrativeGateway ai, ObjectMapper json, TeacherScopeSupport access, StudentReportEmailService email,
            PlatformTransactionManager manager) {
        this.reports = reports; this.students = students; this.evidence = evidence; this.ai = ai;
        this.json = json; this.access = access; this.email = email; this.transactions = new TransactionTemplate(manager);
    }
    @Transactional
    public View prepare(Scope scope, UUID caller) {
        Document fresh = evidence.build(scope, caller);
        // Serialize prepare calls for the same student, including simultaneous browser tabs.
        students.findForReportPreparation(scope.studentId()).orElseThrow();
        String key = ReportEvidence.fingerprint(fresh.dateFrom() + ":" + fresh.dateTo() + ":" + fresh.courseOfferingIds());
        StudentReport report = reports.findFirstByStudentIdAndCreatedByIdAndScopeKeyAndPublishedAtIsNullOrderByCreatedAtDesc(
                scope.studentId(), caller, key).orElseGet(() -> {
                    var created = new StudentReport(); created.setStudentId(scope.studentId());
                    created.setCreatedById(caller); created.setScopeKey(key); return created;
                });
        if (report.getId() != null) fresh = merge(fresh, read(report));
        report.setDocument(write(fresh));
        return view(reports.saveAndFlush(report));
    }
    /** Model inference is outside a transaction; version checking prevents overwriting concurrent edits. */
    public View generate(UUID id, Topic topic, long version, UUID caller) {
        View snapshot = transactions.execute(status -> view(editable(id, version, caller)));
        if (snapshot == null) throw new IllegalStateException("Missing report snapshot");
        Section section = section(snapshot.document(), topic);
        requireCurrentPolicy(snapshot.document());
        Generation generated = generateDraft(snapshot.document(), section);
        String text = generated.summary();
        if (topic == Topic.LEARNING && !"RECORDS".equals(generated.provider())) {
            text += "\n\nStrengths\n" + generated.strengths() + "\n\nNext steps\n" + generated.nextSteps();
        }
        String result = text;
        return transactions.execute(status -> {
            StudentReport report = editable(id, version, caller);
            Document document = read(report);
            Section old = section(document, topic);
            Section next = new Section(topic, old.title(), old.evidence(), old.fingerprint(), result,
                    generated.provider(), false, false, null, null);
            report.setDocument(write(replace(document, next)));
            return view(reports.saveAndFlush(report));
        });
    }
    private Generation generateDraft(Document document, Section section) {
        if (section.topic() == Topic.ATTENDANCE || section.topic() == Topic.PAYMENTS) {
            return ReportRecordsDraft.generate(document, section.topic());
        }
        if (section.topic() == Topic.LEARNING && document.snapshot() != null && document.snapshot().feedbackCount() == 0) {
            return new Generation("No teacher feedback recorded for the selected courses and dates.",
                    "Not applicable", "Not applicable", "RECORDS");
        }
        return ai.generate(document, section);
    }
    @Transactional
    public View save(UUID id, Topic topic, Edit edit, UUID caller) {
        StudentReport report = editable(id, edit.version(), caller);
        Document document = read(report);
        Section old = section(document, topic);
        if (edit.approve()) requireCurrentPolicy(document);
        String name = edit.approve() ? access.requireCaller(caller).getName() : null;
        Section next = ReportSectionReview.edit(old, edit, name);
        report.setDocument(write(replace(document, next)));
        return view(reports.saveAndFlush(report));
    }
    @Transactional(readOnly = true)
    public View get(UUID id, UUID caller) {
        StudentReport report = require(id);
        evidence.authorize(report.getStudentId(), read(report).courseOfferingIds(), caller);
        return view(report);
    }
    @Transactional
    public View publish(UUID id, long version, UUID caller) {
        StudentReport report = editable(id, version, caller);
        requireReviewed(read(report));
        requireCurrentPolicy(read(report));
        report.setPublishedAt(Instant.now());
        return view(reports.saveAndFlush(report));
    }
    public ReportEmailGateway.DeliveryResult email(UUID id, long version, UUID caller) {
        return email.deliver(id, version, caller);
    }
    @Transactional(readOnly = true)
    public List<View> published(UUID studentId) {
        return reports.findByStudentIdAndPublishedAtIsNotNullOrderByPublishedAtDesc(studentId).stream().map(this::view).toList();
    }
    private StudentReport editable(UUID id, long version, UUID caller) {
        StudentReport report = require(id);
        evidence.authorize(report.getStudentId(), read(report).courseOfferingIds(), caller);
        if (report.getPublishedAt() != null) throw new ResponseStatusException(CONFLICT,
                "Published reports are frozen. Prepare a new draft to make changes.");
        if (!Objects.equals(report.getVersion(), version)) throw new ResponseStatusException(CONFLICT,
                "This report changed in another window. Reopen it before continuing.");
        return report;
    }
    private StudentReport require(UUID id) {
        return reports.findById(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Report not found."));
    }
    private View view(StudentReport report) {
        Document document = read(report);
        String name = document.snapshot() == null ? students.findById(report.getStudentId()).orElseThrow().getFullName()
                : document.snapshot().student().fullName();
        return new View(report.getId(), report.getStudentId(), name,
                report.getVersion(), report.getCreatedAt(), report.getPublishedAt(), document);
    }
    private Document read(StudentReport report) {
        return ReportDocumentJson.read(json, report.getDocument(), Document.class, "Invalid stored report");
    }
    private String write(Document document) {
        return ReportDocumentJson.write(json, document, "Could not store report");
    }
    static Document merge(Document fresh, Document saved) {
        var sections = ReportSectionReview.merge(fresh.sections(), saved.sections());
        return new Document(fresh.dateFrom(), fresh.dateTo(), fresh.courseOfferingIds(), fresh.courseLabels(), sections, fresh.snapshot());
    }
    private Section section(Document document, Topic topic) {
        return document.sections().stream().filter(section -> section.topic() == topic).findFirst()
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "This report has no such section."));
    }
    private Document replace(Document document, Section next) {
        return new Document(document.dateFrom(), document.dateTo(), document.courseOfferingIds(), document.courseLabels(),
                document.sections().stream().map(section -> section.topic() == next.topic() ? next : section).toList(), document.snapshot());
    }
    static void requireReviewed(Document document) {
        ReportSectionReview.requireReviewed(document.sections());
    }
    static void requireCurrentPolicy(Document document) {
        ReportSectionReview.requireCurrentPolicy(document.sections());
    }
}
