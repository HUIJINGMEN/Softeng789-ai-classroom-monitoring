package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.*;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Document;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Snapshot;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.*;

/** Numerical summaries are derived from the same immutable facts as the tables and charts. */
final class OverallReportDrafts {
    private OverallReportDrafts() { }
    static List<Section> sections(Snapshot snapshot, Audience audience, List<String> notes) {
        var a = snapshot.attendance();
        List<Section> result = new ArrayList<>();
        result.add(factual(Topic.OVERVIEW, "Executive summary", List.of(
                snapshot.courses().size() + " courses; " + snapshot.studentCount() + " distinct students; "
                + snapshot.completedSessions() + " past completed sessions. " + snapshot.feedbackCount() + " class-wide teacher notes.",
                "Audience: " + audience + ". No financial data or individual student records are included."),
                "This report covers " + snapshot.courses().size() + " courses and " + snapshot.studentCount()
                + " distinct students, with " + snapshot.completedSessions() + " completed sessions in the selected period. "
                + snapshot.feedbackCount() + " class-wide teacher feedback notes are available. "
                + "Read attendance alongside recording completeness. The report does not measure individual engagement or establish learning improvement."));
        String rate = a.rate() == null ? "An attendance rate is not available." : "Attendance among recorded marks is " + a.rate() + "%.";
        result.add(factual(Topic.ATTENDANCE, "Attendance & recording quality", List.of(
                "Expected marks=" + a.completed() + "; present=" + a.present() + "; late=" + a.late()
                + "; absent=" + a.absent() + "; not recorded=" + a.unrecorded() + ". " + rate,
                "Weighted by recorded student marks. Historical enrolment dates are respected. Future and cancelled sessions are excluded."),
                a.present() + " present, " + a.late() + " late and " + a.absent() + " absent marks are recorded. "
                + a.unrecorded() + " expected marks are not recorded; these are not absences. " + rate
                + " Incomplete records limit how confidently these figures describe the whole reporting scope."));
        List<String> absenceFacts = new ArrayList<>();
        absenceFacts.add(a.absent() + " absence marks in past completed sessions. No individual absence reasons are included.");
        snapshot.creditDecisions().forEach(row -> absenceFacts.add("Linked lesson-credit decision " + row.status() + ": " + row.count()));
        absenceFacts.add("Credit decisions are not make-up attendance. A booking does not prove completion, and an absence does not automatically require a make-up.");
        result.add(factual(Topic.ABSENCES, audience == Audience.INTERNAL ? "Absence follow-up" : "Continuity & follow-up",
                absenceFacts, String.join("\n", absenceFacts) + "\nFollow-up should be based on checked records and the arrangements actually recorded."));
        var learningFacts = notes.isEmpty() ? List.of("No class-wide teacher feedback is recorded for the selected dates. No assessment can be inferred.") : notes;
        if (notes.isEmpty()) result.add(factual(Topic.LEARNING, "Teaching feedback & next steps", learningFacts,
                "No class-wide teacher feedback is recorded for this reporting period. An assessment of teaching strengths or improvement is not available."));
        else result.add(ReportEvidence.section(Topic.LEARNING, "Teaching feedback & next steps", learningFacts));
        return List.copyOf(result);
    }
    private static Section factual(Topic topic, String title, List<String> facts, String text) {
        var section = ReportEvidence.section(topic, title, facts);
        return new Section(topic, title, section.evidence(), section.fingerprint(), text, "RECORDS", false, false, null, null);
    }
    static Document replace(Document document, List<Section> sections) {
        return new Document(document.dateFrom(), document.dateTo(), document.audience(), document.courseOfferingIds(), sections, document.snapshot());
    }
}
