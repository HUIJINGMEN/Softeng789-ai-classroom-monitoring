package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentSubmission;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentAccountState;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.ChargeSuggestionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.StudentChargeSuggestionsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.StudentPaymentAccountDtos.StudentPaymentAccountRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.StudentPaymentAccountDtos.StudentPaymentDirectorySummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.stream.Collectors;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.balance;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.charges;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.credits;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.payments;

/** Maps loaded billing records into the stable student payment directory response model. */
final class StudentPaymentAccountAssembler {
    private static final String CURRENCY = "NZD";
    private static final EnumSet<InvoiceStatus> OPEN_STATUSES = EnumSet.of(
            InvoiceStatus.PENDING,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.OVERDUE
    );

    private StudentPaymentAccountAssembler() {
    }

    static StudentPaymentAccountRowResponse row(
            Student student,
            List<StudentInvoice> invoices,
            List<ManualPaymentSubmission> pendingEvidence,
            StudentChargeSuggestionsResponse suggestions
    ) {
        List<StudentInvoice> liveInvoices = invoices.stream()
                .filter(invoice -> invoice.getStatus() != InvoiceStatus.CANCELLED)
                .toList();
        List<StudentInvoice> issuedInvoices = liveInvoices.stream()
                .filter(invoice -> invoice.getStatus() != InvoiceStatus.DRAFT)
                .toList();
        List<String> courses = courseLabels(suggestions);
        List<String> unbilledCourses = unbilledCourseLabels(suggestions);
        StudentPaymentAccountState state = StudentPaymentAccountPolicy.deriveState(
                !pendingEvidence.isEmpty(),
                liveInvoices.stream().map(StudentInvoice::getStatus).collect(Collectors.toSet()),
                unbilledCourses.size()
        );
        StudentInvoice primary = StudentPaymentAccountPolicy.primaryInvoice(liveInvoices, pendingEvidence, state);

        return new StudentPaymentAccountRowResponse(
                student.getId(),
                student.getFullName(),
                student.getStudentNumber(),
                courses,
                total(issuedInvoices, invoice -> charges(invoice).subtract(credits(invoice))),
                total(issuedInvoices, StudentPaymentAccountAssembler::invoicePayments),
                total(issuedInvoices, StudentPaymentAccountAssembler::invoiceBalance),
                money(pendingEvidence.stream().map(ManualPaymentSubmission::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)),
                liveInvoices.size(),
                liveInvoices.stream().filter(invoice -> invoice.getStatus() == InvoiceStatus.DRAFT).count(),
                pendingEvidence.size(),
                unbilledCourses.size(),
                unbilledCourses,
                nextDueDate(issuedInvoices),
                primary == null ? null : primary.getId(),
                primary == null ? null : primary.getTitle(),
                state,
                CURRENCY
        );
    }

    static StudentPaymentDirectorySummaryResponse summary(List<StudentPaymentAccountRowResponse> rows) {
        return new StudentPaymentDirectorySummaryResponse(
                rows.size(),
                rows.stream().filter(row -> StudentPaymentAccountPolicy.needsAction(row.state())).count(),
                rows.stream().filter(row -> StudentPaymentAccountPolicy.awaitingPayment(row.state())).count(),
                rows.stream().filter(row -> row.state() == StudentPaymentAccountState.PAID).count(),
                rows.stream().filter(row -> row.state() == StudentPaymentAccountState.NO_PAYMENT_DUE).count(),
                money(rows.stream().map(StudentPaymentAccountRowResponse::balance)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)),
                money(rows.stream().map(StudentPaymentAccountRowResponse::paymentReported)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)),
                CURRENCY
        );
    }

    static StudentPaymentDirectorySummaryResponse emptySummary() {
        return new StudentPaymentDirectorySummaryResponse(
                0, 0, 0, 0, 0, money(BigDecimal.ZERO), money(BigDecimal.ZERO), CURRENCY
        );
    }

    private static List<String> courseLabels(StudentChargeSuggestionsResponse suggestions) {
        if (suggestions == null) return List.of();
        return suggestions.courses().stream()
                .map(course -> course.courseCode() + " · " + course.academicTerm())
                .collect(Collectors.collectingAndThen(
                        Collectors.toCollection(LinkedHashSet::new),
                        List::copyOf
                ));
    }

    private static List<String> unbilledCourseLabels(StudentChargeSuggestionsResponse suggestions) {
        if (suggestions == null) return List.of();
        return suggestions.courses().stream()
                .filter(course -> course.status() == ChargeSuggestionStatus.READY
                        || course.status() == ChargeSuggestionStatus.NEEDS_PRICE)
                .map(course -> course.courseCode() + " · " + course.academicTerm())
                .toList();
    }

    private static BigDecimal total(
            List<StudentInvoice> invoices,
            java.util.function.Function<StudentInvoice, BigDecimal> amount
    ) {
        return money(invoices.stream().map(amount).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private static BigDecimal invoicePayments(StudentInvoice invoice) {
        return payments(invoice);
    }

    private static BigDecimal invoiceBalance(StudentInvoice invoice) {
        return balance(invoice);
    }

    private static LocalDate nextDueDate(List<StudentInvoice> invoices) {
        return invoices.stream()
                .filter(invoice -> OPEN_STATUSES.contains(invoice.getStatus()))
                .map(StudentInvoice::getDueDate)
                .min(LocalDate::compareTo)
                .orElse(null);
    }
}
