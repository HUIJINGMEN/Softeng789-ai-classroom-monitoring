package io.github.huijingmen.softeng789.classroommonitoring.reports;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.service.TeacherScopeSupport;
import java.time.Instant;
import java.util.*;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.View;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.*;

@Service
public class OverallReportService {
    private final OverallReportRepository reports;
    private final OverallReportEvidence evidence;
    private final ReportNarrativeGateway ai;
    private final TeacherScopeSupport access;
    private final ObjectMapper json;
    private final TransactionTemplate transactions;
    public OverallReportService(OverallReportRepository reports, OverallReportEvidence evidence,
            ReportNarrativeGateway ai, TeacherScopeSupport access, ObjectMapper json, PlatformTransactionManager manager) {
        this.reports = reports; this.evidence = evidence; this.ai = ai; this.access = access;
        this.json = json; this.transactions = new TransactionTemplate(manager);
    }
    @Transactional
    public View prepare(OverallReportModels.Scope requested, UUID caller) {
        evidence.authorize(caller);
        var scope = evidence.normalize(requested);
        var fresh = evidence.build(scope, caller);
        String key = ReportEvidence.fingerprint(scope.toString());
        var report = reports.findFirstByCreatedByIdAndScopeKeyAndFinalizedAtIsNullOrderByCreatedAtDesc(caller, key)
                .orElseGet(() -> {
                    var created = new OverallReport(); created.setCreatedById(caller); created.setScopeKey(key); return created;
                });
        if (report.getId() != null) fresh = OverallReportDrafts.replace(fresh,
                ReportSectionReview.merge(fresh.sections(), read(report).sections()));
        report.setDocument(write(fresh));
        return view(reports.saveAndFlush(report));
    }
    public View generate(UUID id, Topic topic, long version, UUID caller) {
        var draft = Objects.requireNonNull(transactions.execute(status -> view(editable(id, version, caller))));
        ReportSectionReview.requireCurrentPolicy(draft.document().sections());
        var old = section(draft.document(), topic);
        Section next;
        if (topic == Topic.LEARNING && draft.document().snapshot().feedbackCount() > 0) {
            var generated = ai.generateOverall(draft.document(), old);
            String text = generated.summary() + "\n\nStrengths\n" + generated.strengths() + "\n\nNext steps\n" + generated.nextSteps();
            next = new Section(topic, old.title(), old.evidence(), old.fingerprint(), text, generated.provider(), false, false, null, null);
        } else {
            var fresh = OverallReportDrafts.sections(draft.document().snapshot(), draft.document().audience(), List.of()).stream()
                    .filter(row -> row.topic() == topic).findFirst().orElseThrow();
            next = new Section(topic, old.title(), old.evidence(), old.fingerprint(), fresh.text(), "RECORDS", false, false, null, null);
        }
        return transactions.execute(status -> {
            var report = editable(id, version, caller);
            report.setDocument(write(replace(read(report), next)));
            return view(reports.saveAndFlush(report));
        });
    }
    @Transactional
    public View save(UUID id, Topic topic, Edit edit, UUID caller) {
        var report = editable(id, edit.version(), caller);
        var document = read(report);
        if (edit.approve()) ReportSectionReview.requireCurrentPolicy(document.sections());
        String reviewer = edit.approve() ? access.requireCaller(caller).getName() : null;
        report.setDocument(write(replace(document, ReportSectionReview.edit(section(document, topic), edit, reviewer))));
        return view(reports.saveAndFlush(report));
    }
    @Transactional
    public View finalizeReport(UUID id, Finalize revision, UUID caller) {
        var report = require(id, caller);
        if (report.getFinalizedAt() != null && (report.getVersion().equals(revision.version())
                || report.getVersion() == revision.version() + 1)) return view(report);
        checkVersion(report, revision.version());
        var document = read(report);
        ReportSectionReview.requireReviewed(document.sections());
        ReportSectionReview.requireCurrentPolicy(document.sections());
        if (document.audience() == Audience.PARTNER && !revision.privacyReviewed()) throw new ResponseStatusException(CONFLICT,
                "Check the partner preview for personal or confidential wording before export.");
        if (document.audience() == Audience.PARTNER) {
            report.setPrivacyReviewedBy(access.requireCaller(caller).getName());
            report.setPrivacyReviewedAt(Instant.now());
        }
        report.setFinalizedAt(Instant.now());
        return view(reports.saveAndFlush(report));
    }
    @Transactional(readOnly = true)
    public View get(UUID id, UUID caller) { return view(require(id, caller)); }
    @Transactional(readOnly = true)
    public List<View> history(UUID caller) {
        evidence.authorize(caller);
        return reports.findTop10ByFinalizedAtIsNotNullOrderByFinalizedAtDesc().stream().map(this::view).toList();
    }
    private OverallReport require(UUID id, UUID caller) {
        evidence.authorize(caller);
        return reports.findById(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Overall report not found."));
    }
    private OverallReport editable(UUID id, long version, UUID caller) {
        var report = require(id, caller); checkVersion(report, version); return report;
    }
    private void checkVersion(OverallReport report, long version) {
        if (report.getFinalizedAt() != null) throw new ResponseStatusException(CONFLICT, "Saved reports are frozen. Prepare a new draft.");
        if (!Objects.equals(report.getVersion(), version)) throw new ResponseStatusException(CONFLICT,
                "This report changed in another window. Reopen it before continuing.");
    }
    private Section section(OverallReportModels.Document document, Topic topic) {
        return document.sections().stream().filter(row -> row.topic() == topic).findFirst()
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "This report has no such section."));
    }
    private OverallReportModels.Document replace(OverallReportModels.Document document, Section next) {
        return OverallReportDrafts.replace(document, document.sections().stream().map(row -> row.topic() == next.topic() ? next : row).toList());
    }
    private View view(OverallReport report) {
        return new View(report.getId(), report.getVersion(), report.getCreatedAt(), report.getFinalizedAt(),
                report.getPrivacyReviewedBy(), report.getPrivacyReviewedAt(), OverallReportPrivacy.project(read(report)));
    }
    private OverallReportModels.Document read(OverallReport report) {
        return ReportDocumentJson.read(json, report.getDocument(), OverallReportModels.Document.class, "Invalid stored overall report");
    }
    private String write(OverallReportModels.Document document) {
        return ReportDocumentJson.write(json, document, "Could not store overall report");
    }
}
