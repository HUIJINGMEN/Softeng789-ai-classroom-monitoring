package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.ArrayList;
import java.util.List;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

/** Plain-text email equivalent of the document's saved facts and reviewed narratives. */
final class StudentReportText {
    private StudentReportText() { }
    static String render(Document document) {
        List<String> parts = new ArrayList<>();
        Snapshot snapshot = document.snapshot();
        if (snapshot != null) {
            if (snapshot.preparedAt() != null) parts.add("Data as of " + java.time.format.DateTimeFormatter
                    .ofPattern("d MMM uuuu, HH:mm z", java.util.Locale.UK).withZone(java.time.ZoneId.of("Pacific/Auckland"))
                    .format(snapshot.preparedAt()));
            var student = snapshot.student();
            parts.add("Student details\n" + student.fullName() + " · " + student.studentNumber()
                    + "\n" + student.email() + "\nProgramme: " + student.programme() + "; level: " + student.level());
            parts.add("Student course record\n" + snapshot.courses().stream().map(course -> courseLabel(course)
                    + "; lessons attended: " + (course.attendance().present() + course.attendance().late())
                    + "; absences: " + course.attendance().absent() + "; attendance rate: " + rate(course.attendance()))
                    .collect(java.util.stream.Collectors.joining("\n")));
            var attendance = snapshot.attendance();
            parts.add("Student attendance\nAttendance rate: " + rate(attendance) + "; past scheduled lessons: " + attendance.completed()
                    + "; present: " + attendance.present() + "; late: " + attendance.late() + "; absent: " + attendance.absent()
                    + "; not recorded: " + attendance.unrecorded()
                    + "\nOnly this student's lessons within the report dates and enrolment period are counted."
                    + " Attendance rate = (present + late) / (present + late + absent). Unrecorded marks are not absences; future and cancelled lessons are excluded.");
            parts.add("Weekly attendance\n" + snapshot.attendanceTrend().stream()
                    .map(point -> "Week of " + point.weekOf() + ": " + rate(point.attendance()))
                    .collect(java.util.stream.Collectors.joining("\n")));
            parts.add("Confirmed observations for this student\n" + snapshot.confirmedEvents().stream()
                    .map(event -> event.type() + ": " + event.count()).collect(java.util.stream.Collectors.joining("\n")));
            parts.add("Teacher feedback notes in scope: " + snapshot.feedbackCount());
            parts.add("Payment snapshot: selected-course invoices only, not the whole account.\n"
                    + snapshot.payments().invoices().stream().map(invoice -> invoice.number() + " (" + invoice.currency()
                        + "); charges: " + invoice.charges() + "; credits: " + invoice.credits() + "; confirmed receipts: " + invoice.received()
                        + "; balance: " + invoice.balance() + "; awaiting verification (not received): " + invoice.awaitingVerification()
                        + "; due: " + (invoice.due() == null ? "Not specified" : invoice.due())).collect(java.util.stream.Collectors.joining("\n")));
        }
        document.sections().forEach(section -> parts.add(section.title() + "\n" + section.text()));
        return String.join("\n\n", parts);
    }
    private static String rate(AttendanceSummary summary) {
        return summary.rate() == null ? "Not available" : summary.rate() + "%";
    }
    private static String courseLabel(CourseSummary course) {
        return course.name() == null || course.name().isBlank() || course.name().trim().equals(course.code().trim())
                ? course.code() : course.code() + " · " + course.name();
    }
}
