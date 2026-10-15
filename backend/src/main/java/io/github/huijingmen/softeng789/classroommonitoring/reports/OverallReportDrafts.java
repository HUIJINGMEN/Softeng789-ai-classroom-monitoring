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
        List<String> overviewFacts = new ArrayList<>(List.of(
                snapshot.courses().size() + " courses; " + snapshot.studentCount() + " distinct students; "
                + snapshot.completedSessions() + " past completed sessions. " + snapshot.feedbackCount() + " class-wide teacher notes.",
                audience == Audience.INTERNAL ? "Staff-only: includes student names and attendance in the internal roster. No financial data."
                    : "Partner audience: no financial data or individual student records are included.",
                OverallReportContent.coverage(snapshot), OverallReportContent.recording(a)));
        overviewFacts.addAll(OverallReportReviewEvidence.appendix(snapshot, audience));
        result.add(OverallReportReviewEvidence.bindRoster(factual(Topic.OVERVIEW, "Executive summary", overviewFacts,
                OverallReportContent.scopeSummary(snapshot)
                + "\n\n" + OverallReportContent.coverage(snapshot)
                + "\n\n" + OverallReportContent.recording(a) + " Read attendance alongside recording completeness. "
                + "The report does not measure individual engagement or establish learning improvement."), snapshot, audience));
        String rate = a.rate() == null ? "An attendance rate is not available." : "Attendance among recorded marks is " + a.rate() + "%.";
        List<String> attendanceFacts = new ArrayList<>(List.of(
                "Expected marks=" + a.completed() + "; present=" + a.present() + "; late=" + a.late()
                + "; absent=" + a.absent() + "; not recorded=" + a.unrecorded() + ". " + rate,
                "Weighted by recorded student marks. Historical enrolment dates are respected. Future and cancelled sessions are excluded."));
        attendanceFacts.addAll(OverallReportContent.courseFacts(snapshot));
        snapshot.attendanceTrend().forEach(week -> attendanceFacts.add("Week starting " + week.weekOf() + ": "
                + OverallReportContent.attendance(week.attendance())));
        attendanceFacts.add(OverallReportContent.weeklyContext(snapshot));
        result.add(factual(Topic.ATTENDANCE, "Attendance & recording quality", attendanceFacts,
                OverallReportContent.attendance(a) + "\n\n" + OverallReportContent.weeklyContext(snapshot)));
        List<String> absenceFacts = OverallReportContent.absenceFacts(snapshot, audience);
        result.add(factual(Topic.ABSENCES, audience == Audience.INTERNAL ? "Absence follow-up" : "Continuity & follow-up",
                absenceFacts, String.join("\n\n", absenceFacts)));
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
