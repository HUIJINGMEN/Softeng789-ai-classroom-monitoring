package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.InvoiceStatusPolicy;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

@Component
public class PaymentReportEvidence {
    private final StudentInvoiceRepository invoices;
    private final ManualPaymentSubmissionRepository submissions;
    public PaymentReportEvidence(StudentInvoiceRepository invoices, ManualPaymentSubmissionRepository submissions) {
        this.invoices = invoices; this.submissions = submissions;
    }
    Section build(Scope scope) {
        return buildDetailed(scope).section();
    }
    record Result(Section section, PaymentSnapshot snapshot) { }
    Result buildDetailed(Scope scope) {
        List<String> facts = new ArrayList<>();
        facts.add("Snapshot of scoped invoices at report preparation. Period activity and current balance are separate. "
                + "Unbilled enrolments do not imply no payment is due. Draft and cancelled invoices are excluded.");
        var all = invoices.findStatementByStudentId(scope.studentId()).stream()
                .filter(invoice -> invoice.getStatus() != InvoiceStatus.CANCELLED).toList();
        Set<UUID> included = new HashSet<>();
        List<InvoiceSummary> rows = new ArrayList<>();
        var pending = submissions.findByInvoiceStudentIdOrderBySubmittedAtDesc(scope.studentId()).stream()
                .filter(item -> item.getStatus() == ManualPaymentStatus.PENDING).toList();
        for (var invoice : all) {
            var courses = invoice.getEntitlements().stream().map(item -> item.getCourseOffering().getId()).toList();
            if (courses.isEmpty() || !scope.courseOfferingIds().containsAll(courses)) continue;
            included.add(invoice.getId());
            LocalDate issued = invoice.getCreatedAt().atZone(ZoneId.of("Pacific/Auckland")).toLocalDate();
            BigDecimal awaiting = pending.stream().filter(item -> item.getInvoice().getId().equals(invoice.getId()))
                    .map(ManualPaymentSubmission::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            rows.add(new InvoiceSummary(invoice.getInvoiceNumber(), invoice.getCurrency(), issued, invoice.getDueDate(),
                    InvoiceAmounts.charges(invoice), InvoiceAmounts.credits(invoice), InvoiceAmounts.payments(invoice),
                    InvoiceAmounts.balance(invoice), awaiting, InvoiceStatusPolicy.current(invoice).name()));
            facts.add(invoice.getInvoiceNumber() + ": " + invoice.getCurrency() + "; issued " + issued
                    + "; issued in selected period=" + inRange(issued, scope)
                    + "; charges=" + InvoiceAmounts.charges(invoice) + "; credits=" + InvoiceAmounts.credits(invoice)
                    + "; confirmed net receipts to date=" + InvoiceAmounts.payments(invoice)
                    + "; current balance=" + InvoiceAmounts.balance(invoice) + "; due=" + invoice.getDueDate()
                    + "; invoice lifecycle status=" + InvoiceStatusPolicy.current(invoice)
                    + "; payment submissions awaiting verification=" + awaiting);
            for (var payment : invoice.getTransactions()) {
                if (!inRange(payment.getOccurredAt().atZone(ZoneId.of("Pacific/Auckland")).toLocalDate(), scope)) continue;
                facts.add("Period transaction for " + invoice.getInvoiceNumber() + ": " + invoice.getCurrency()
                        + " " + payment.getAmount() + "; " + payment.getStatus());
            }
        }
        if (included.isEmpty()) facts.add("No issued invoices fully attributable to the selected courses.");
        if (included.size() < all.size()) facts.add("Invoices without a course link or spanning courses outside this scope "
                + "are excluded; this is not the student's whole-account balance.");
        pending.stream().filter(item -> included.contains(item.getInvoice().getId()))
                .forEach(item -> facts.add("Awaiting verification, not confirmed received: "
                        + item.getInvoice().getInvoiceNumber() + " " + item.getInvoice().getCurrency() + " " + item.getAmount()));
        return new Result(ReportEvidence.section(Topic.PAYMENTS, "Payments", facts),
                new PaymentSnapshot(List.copyOf(rows), all.size() - included.size()));
    }
    private boolean inRange(LocalDate date, Scope scope) {
        return !date.isBefore(scope.dateFrom()) && !date.isAfter(scope.dateTo());
    }
}
