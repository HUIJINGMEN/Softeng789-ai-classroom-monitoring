package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.ArrayList;
import java.util.List;
import io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.AttendanceSummary;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Audience;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Snapshot;

/** Evidence-derived detail, shared by factual drafts; never infers outcomes from missing records. */
final class OverallReportContent {
    private OverallReportContent() { }

    private static String count(long value, String noun) {
        return value + " " + noun + (value == 1 ? "" : "s");
    }

    static String scopeSummary(Snapshot snapshot) {
        return "This report covers " + count(snapshot.courses().size(), "course") + " and "
                + count(snapshot.studentCount(), "distinct student") + ", with "
                + count(snapshot.completedSessions(), "completed session") + " in the selected period. "
                + count(snapshot.feedbackCount(), "class-wide teacher feedback note")
                + (snapshot.feedbackCount() == 1 ? " is" : " are") + " available.";
    }

    static long recorded(AttendanceSummary attendance) {
        return attendance.present() + attendance.late() + attendance.absent();
    }

    static String recording(AttendanceSummary attendance) {
        if (attendance.completed() == 0) return "No expected attendance marks are available.";
        return recorded(attendance) + " of " + attendance.completed() + " expected marks are recorded ("
                + Math.round(100.0 * recorded(attendance) / attendance.completed()) + "% completeness).";
    }

    static String coverage(Snapshot snapshot) {
        long teachingCourses = snapshot.courses().stream().filter(row -> row.completedSessions() > 0).count();
        long feedbackCourses = snapshot.courses().stream().filter(row -> row.feedbackCount() > 0).count();
        return "Past completed sessions are recorded for " + teachingCourses + " of " + count(snapshot.courses().size(), "course") + ". "
                + "Courses without completed sessions in this period: " + (snapshot.courses().size() - teachingCourses) + ". "
                + "Class-wide teacher feedback is recorded for " + feedbackCourses + " of " + count(snapshot.courses().size(), "course") + ". "
                + "Courses without recorded class-wide feedback: " + (snapshot.courses().size() - feedbackCourses) + ". "
                + "No completed sessions or feedback is a data-availability statement, not a judgement of course quality.";
    }

    static String attendance(AttendanceSummary row) {
        String rate = row.rate() == null ? "Attendance is unavailable because no marks are recorded."
                : "Attendance among recorded marks is " + row.rate() + "% (" + (row.present() + row.late())
                        + " attended of " + recorded(row) + " recorded marks).";
        return row.present() + " present, " + row.late() + " late and " + row.absent() + " absent marks. "
                + count(row.unrecorded(), "expected mark") + (row.unrecorded() == 1 ? " is" : " are")
                + " not recorded; missing marks are not absences. " + rate + " " + recording(row);
    }

    static List<String> courseFacts(Snapshot snapshot) {
        return snapshot.courses().stream().map(row -> row.code() + " · " + row.term() + ": "
                + count(row.students(), "student") + ", " + count(row.completedSessions(), "completed session") + "; "
                + attendance(row.attendance()) + " Class-wide teacher notes: " + row.feedbackCount() + ".").toList();
    }

    static String weeklyContext(Snapshot snapshot) {
        if (snapshot.attendanceTrend().isEmpty()) return "No weekly attendance records are available for comparison.";
        var first = snapshot.attendanceTrend().getFirst();
        var last = snapshot.attendanceTrend().getLast();
        String result = "First included week, starting " + first.weekOf() + ": " + attendance(first.attendance());
        if (!first.weekOf().equals(last.weekOf())) result += "\n\nLast included week, starting " + last.weekOf()
                + ": " + attendance(last.attendance());
        return result + "\n\nWeeks may have different courses, enrolments and recording completeness. "
                + "These figures alone do not establish improvement or deterioration.";
    }

    static List<String> absenceFacts(Snapshot snapshot, Audience audience) {
        List<String> facts = new ArrayList<>();
        long affectedCourses = snapshot.courses().stream().filter(row -> row.attendance().absent() > 0).count();
        facts.add("Recorded absence marks: " + snapshot.attendance().absent() + "; courses with absences: " + affectedCourses
                + ". Only past completed sessions are included. These are student-session marks, not distinct absent students. "
                + "No individual absence reasons are included.");
        snapshot.courses().stream().filter(row -> row.attendance().absent() > 0).limit(5)
                .forEach(row -> facts.add(row.code() + " · " + row.term() + ": " + count(row.attendance().absent(), "absence mark") + "."));
        if (affectedCourses > 5) facts.add("Another " + (affectedCourses - 5)
                + " courses have absence marks; all course counts appear in the course comparison.");
        if (audience == Audience.INTERNAL) snapshot.creditDecisions().forEach(row -> facts.add(
                "Linked lesson-credit status " + row.status() + ": " + row.count()));
        facts.add("Credit statuses are separate from absence counts and do not show distinct students or completed make-ups. "
                + "A booking does not prove completion, and an absence does not automatically require a make-up.");
        facts.add("Check missing attendance first, then review confirmed absence records and linked arrangements privately. "
                + "Any suggested follow-up remains a recommendation, not a completed action.");
        return List.copyOf(facts);
    }
}
