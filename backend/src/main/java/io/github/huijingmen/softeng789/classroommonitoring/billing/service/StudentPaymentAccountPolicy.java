package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentSubmission;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentAccountState;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentDirectoryFilter;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.StudentPaymentAccountDtos.StudentPaymentAccountRowResponse;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

/** Pure business rules for classifying and ordering student payment accounts. */
final class StudentPaymentAccountPolicy {
    private StudentPaymentAccountPolicy() {
    }

    static StudentPaymentAccountState deriveState(
            boolean hasPendingEvidence,
            Set<InvoiceStatus> statuses,
            int unbilledCourseCount
    ) {
        if (hasPendingEvidence) return StudentPaymentAccountState.PAYMENT_REVIEW;
        if (statuses.contains(InvoiceStatus.OVERDUE)) return StudentPaymentAccountState.OVERDUE;
        if (statuses.contains(InvoiceStatus.DRAFT)) return StudentPaymentAccountState.DRAFT;
        if (unbilledCourseCount > 0) return StudentPaymentAccountState.NEEDS_INVOICE;
        if (statuses.contains(InvoiceStatus.PARTIALLY_PAID)) return StudentPaymentAccountState.PARTIALLY_PAID;
        if (statuses.contains(InvoiceStatus.PENDING)) return StudentPaymentAccountState.PAYMENT_DUE;
        if (statuses.contains(InvoiceStatus.PAID)) return StudentPaymentAccountState.PAID;
        return StudentPaymentAccountState.NO_PAYMENT_DUE;
    }

    static StudentInvoice primaryInvoice(
            List<StudentInvoice> invoices,
            List<ManualPaymentSubmission> pendingEvidence,
            StudentPaymentAccountState state,
            LocalDate today
    ) {
        if (!pendingEvidence.isEmpty()) return pendingEvidence.getFirst().getInvoice();
        InvoiceStatus preferred = switch (state) {
            case OVERDUE -> InvoiceStatus.OVERDUE;
            case DRAFT -> InvoiceStatus.DRAFT;
            case PARTIALLY_PAID -> InvoiceStatus.PARTIALLY_PAID;
            case PAYMENT_DUE -> InvoiceStatus.PENDING;
            case PAID -> InvoiceStatus.PAID;
            default -> null;
        };
        if (preferred == null) return null;
        return invoices.stream()
                .filter(invoice -> InvoiceStatusPolicy.current(invoice, today) == preferred)
                .min(Comparator.comparing(StudentInvoice::getDueDate))
                .orElse(null);
    }

    static boolean matches(StudentPaymentDirectoryFilter filter, StudentPaymentAccountState state) {
        if (filter == null) return true;
        return switch (filter) {
            case NEEDS_ACTION -> needsAction(state);
            case AWAITING_PAYMENT -> awaitingPayment(state);
            case PAID -> state == StudentPaymentAccountState.PAID;
        };
    }

    static boolean needsAction(StudentPaymentAccountState state) {
        return switch (state) {
            case PAYMENT_REVIEW, OVERDUE, DRAFT, NEEDS_INVOICE -> true;
            default -> false;
        };
    }

    static boolean awaitingPayment(StudentPaymentAccountState state) {
        return state == StudentPaymentAccountState.PARTIALLY_PAID
                || state == StudentPaymentAccountState.PAYMENT_DUE;
    }

    static Comparator<StudentPaymentAccountRowResponse> accountOrder() {
        return Comparator.comparingInt((StudentPaymentAccountRowResponse row) -> priority(row.state()))
                .thenComparing(row -> row.nextDueDate() == null ? LocalDate.MAX : row.nextDueDate())
                .thenComparing(StudentPaymentAccountRowResponse::studentName, String.CASE_INSENSITIVE_ORDER);
    }

    private static int priority(StudentPaymentAccountState state) {
        return switch (state) {
            case PAYMENT_REVIEW -> 0;
            case OVERDUE -> 1;
            case DRAFT -> 2;
            case NEEDS_INVOICE -> 3;
            case PARTIALLY_PAID -> 4;
            case PAYMENT_DUE -> 5;
            case PAID -> 6;
            case NO_PAYMENT_DUE -> 7;
        };
    }
}
