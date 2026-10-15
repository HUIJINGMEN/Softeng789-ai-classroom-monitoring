package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ClassReportModels.*;

/** Class-only issued invoices; never allocate a mixed-course invoice or combine currencies. */
@Component
public class ClassReportPayments {
    private final StudentInvoiceRepository invoices;
    private final ManualPaymentSubmissionRepository submissions;
    public ClassReportPayments(StudentInvoiceRepository invoices, ManualPaymentSubmissionRepository submissions) {
        this.invoices = invoices; this.submissions = submissions;
    }
    Payments build(UUID courseId, List<UUID> studentIds) {
        if (studentIds.isEmpty()) return new Payments(List.of(), 0, 0);
        var issued = invoices.findByStudent_IdInOrderByDueDateAscCreatedAtDesc(studentIds).stream()
                .filter(row -> row.getStatus() != InvoiceStatus.DRAFT && row.getStatus() != InvoiceStatus.CANCELLED).toList();
        var attributable = issued.stream().filter(row -> !row.getEntitlements().isEmpty()
                && row.getEntitlements().stream().allMatch(item -> item.getCourseOffering().getId().equals(courseId))).toList();
        int excluded = (int) issued.stream().filter(row -> row.getEntitlements().isEmpty()
                || (row.getEntitlements().stream().anyMatch(item -> item.getCourseOffering().getId().equals(courseId))
                    && row.getEntitlements().stream().anyMatch(item -> !item.getCourseOffering().getId().equals(courseId)))).count();
        var pending = submissions.findByInvoice_Student_IdInAndStatusOrderBySubmittedAtAsc(studentIds, ManualPaymentStatus.PENDING).stream()
                .collect(Collectors.groupingBy(row -> row.getInvoice().getId(), Collectors.reducing(BigDecimal.ZERO,
                        ManualPaymentSubmission::getAmount, BigDecimal::add)));
        var groups = attributable.stream().collect(Collectors.groupingBy(StudentInvoice::getCurrency, TreeMap::new, Collectors.toList()));
        var totals = groups.entrySet().stream().map(entry -> new CurrencyTotal(entry.getKey(), entry.getValue().size(),
                sum(entry.getValue(), InvoiceAmounts::charges), sum(entry.getValue(), InvoiceAmounts::credits),
                sum(entry.getValue(), InvoiceAmounts::payments), sum(entry.getValue(), InvoiceAmounts::balance),
                entry.getValue().stream().map(row -> pending.getOrDefault(row.getId(), BigDecimal.ZERO)).reduce(BigDecimal.ZERO, BigDecimal::add))).toList();
        long billedStudents = attributable.stream().map(row -> row.getStudent().getId()).distinct().count();
        return new Payments(totals, excluded, studentIds.size() - (int) billedStudents);
    }
    private BigDecimal sum(List<StudentInvoice> rows, java.util.function.Function<StudentInvoice, BigDecimal> amount) {
        return rows.stream().map(amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
