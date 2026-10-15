package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import org.springframework.web.server.ResponseStatusException;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static org.springframework.http.HttpStatus.CONFLICT;

/** Numerical narratives come from the same frozen snapshot as the report's charts and tables. */
final class ReportRecordsDraft {
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM uuuu", Locale.ENGLISH);
    private ReportRecordsDraft() { }

    static Generation generate(Document document, Topic topic) {
        if (document.snapshot() == null) throw new ResponseStatusException(CONFLICT,
                "Reopen report preparation to save a current student snapshot before generating this section.");
        String text = topic == Topic.ATTENDANCE ? attendance(document.snapshot().attendance())
                : payments(document.snapshot().payments());
        return new Generation(text, "Not applicable", "Not applicable", "RECORDS");
    }

    private static String attendance(AttendanceSummary count) {
        long attended = count.present() + count.late();
        if (count.completed() == 0) return "There are no past scheduled lessons applicable to your enrolment in this report. "
                + "An attendance rate is not available yet.";
        String text = "Of " + count.completed() + " past scheduled lessons applicable to your enrolment, you attended "
                + attended + " (" + count.present() + " present and " + count.late() + " late). "
                + count.absent() + (count.absent() == 1 ? " absence is recorded. " : " absences are recorded. ");
        text += count.rate() == null ? "There are no recorded attendance marks from which to calculate a rate. "
                : "Your attendance rate among recorded marks is " + count.rate() + "%. ";
        if (count.unrecorded() > 0) text += count.unrecorded()
                + (count.unrecorded() == 1 ? " lesson has no recorded mark; this is not counted as an absence. "
                        : " lessons have no recorded mark; these are not counted as absences. ")
                + "Please let the teaching team know if any of these records need checking. ";
        return text.trim();
    }

    private static String payments(PaymentSnapshot snapshot) {
        if (snapshot.invoices().isEmpty()) return "No issued invoices could be attributed fully to the selected courses. "
                + "Billing information for this report is not available; this does not mean that nothing is owed. "
                + "Please contact the team if you would like help checking the details.";
        var currencies = snapshot.invoices().stream().collect(Collectors.groupingBy(
                InvoiceSummary::currency, java.util.TreeMap::new, Collectors.toList()));
        String text = currencies.entrySet().stream().map(entry -> currencyUpdate(entry.getKey(), entry.getValue()))
                .collect(Collectors.joining("\n\n"));
        return text + "\n\nFigures cover the included invoices at preparation, not just activity in the reporting period "
                + "or the whole account. Please contact the team if any details need checking.";
    }

    private static String currencyUpdate(String currency, List<InvoiceSummary> rows) {
        BigDecimal received = total(rows, InvoiceSummary::received);
        BigDecimal balance = total(rows, InvoiceSummary::balance);
        BigDecimal awaiting = total(rows, InvoiceSummary::awaitingVerification);
        String text = received.signum() > 0
                ? "Thank you for the confirmed net payments of " + money(currency, received) + " for these invoices. "
                : "Confirmed net receipts for these invoices total " + money(currency, received) + ". ";
        if (balance.signum() > 0) {
            text += "The current outstanding balance is " + money(currency, balance) + ". ";
            var due = rows.stream().filter(row -> row.balance().signum() > 0 && row.due() != null)
                    .map(InvoiceSummary::due).min(java.time.LocalDate::compareTo);
            if (due.isPresent()) text += "The earliest recorded due date for an unpaid invoice is " + DATE.format(due.get()) + ". ";
        } else if (balance.signum() < 0) {
            text += "The included invoices show a credit balance of " + money(currency, balance.abs()) + ". ";
        } else text += "There is no outstanding balance on these included invoices. ";
        if (awaiting.signum() > 0) text += "Payment details for " + money(currency, awaiting)
                + " are awaiting verification and have not reduced this balance. "
                + "Please check their status with the team before making another transfer.";
        return text.trim();
    }

    private static BigDecimal total(List<InvoiceSummary> rows, java.util.function.Function<InvoiceSummary, BigDecimal> value) {
        return rows.stream().map(value).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
    private static String money(String currency, BigDecimal value) {
        return currency + " " + value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
