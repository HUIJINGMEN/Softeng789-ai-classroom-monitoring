package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.ArrayList;
import java.util.List;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

/** Calculated attendance, finances and absence counts cannot be rewritten by a language model. */
final class ClassReportRecordsDraft {
    private ClassReportRecordsDraft() { }
    static Generation generate(ClassReportModels.Document document, Section section) {
        var snapshot = document.snapshot();
        String text;
        if (section.topic() == Topic.ATTENDANCE) {
            var totals = snapshot.attendance();
            String rate = totals.rate() == null ? "No attendance rate is available without recorded marks."
                    : "The attendance rate among recorded marks is " + totals.rate() + "%.";
            text = snapshot.completedSessions() + " past completed sessions are included for " + snapshot.studentCount()
                    + " students in scope. There are " + totals.present() + " present, " + totals.late() + " late and "
                    + totals.absent() + " absent marks. " + totals.unrecorded() + " expected marks are not recorded; these are not absences. "
                    + rate + " Check incomplete records before drawing conclusions about class attendance.";
        } else if (section.topic() == Topic.PAYMENTS) {
            List<String> paragraphs = new ArrayList<>();
            for (var row : snapshot.payments().totals()) paragraphs.add(row.invoices() + " issued class-only invoice(s) in " + row.currency()
                    + ": charges " + row.charges() + ", credits " + row.credits() + ", confirmed net receipts " + row.received()
                    + " and outstanding balance " + row.balance() + ". " + row.awaitingVerification()
                    + " is awaiting verification and has not reduced the balance.");
            if (paragraphs.isEmpty()) paragraphs.add("No issued invoices fully attributable to this class are available. This does not imply no fees are due.");
            paragraphs.add(snapshot.payments().studentsWithoutInvoice() + " students have no attributable class-only invoice. "
                    + snapshot.payments().excludedInvoices() + " mixed-course or unlinked invoices are excluded. Figures are a snapshot at preparation, "
                    + "not transactions only within the reporting period or whole-account balances. Please check billing and pending submissions before requesting further payment.");
            text = String.join("\n\n", paragraphs);
        } else if (section.topic() == Topic.ABSENCES) {
            text = String.join("\n", section.evidence()) + "\nPlease review any necessary follow-up privately with the students concerned.";
        } else {
            text = "No class-wide teacher feedback recorded for the selected dates. Individual student notes are not substituted for a class assessment.";
        }
        return new Generation(text, "Not applicable", "Not applicable", "RECORDS");
    }
}
