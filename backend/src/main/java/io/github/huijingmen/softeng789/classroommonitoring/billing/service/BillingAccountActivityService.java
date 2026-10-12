package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AccountActivityType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.BillingAccountActivity;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentSubmission;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentTransaction;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentSessionPackage;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.AccountActivityResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.AccountTimelineEventResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.BillingAccountActivityRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.charges;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.credits;

/**
 * Owns the append-only account audit trail and its read models.
 *
 * <p>Keeping this concern out of the command services makes it much harder for a new lifecycle
 * operation to accidentally invent a second timeline format.</p>
 */
@Service
public class BillingAccountActivityService {
    private final BillingAccountActivityRepository activityRepository;

    public BillingAccountActivityService(BillingAccountActivityRepository activityRepository) {
        this.activityRepository = activityRepository;
    }

    public void record(
            Student student,
            StudentInvoice invoice,
            StudentSessionPackage sessionPackage,
            AccountActivityType type,
            BigDecimal amount,
            String fromValue,
            String toValue,
            String reason,
            Teacher actor
    ) {
        record(student, invoice, sessionPackage, type, amount, fromValue, toValue, reason, actor, null);
    }

    public void record(
            Student student,
            StudentInvoice invoice,
            StudentSessionPackage sessionPackage,
            AccountActivityType type,
            BigDecimal amount,
            String fromValue,
            String toValue,
            String reason,
            Teacher actor,
            String externalReference
    ) {
        BillingAccountActivity activity = new BillingAccountActivity();
        activity.setStudent(student);
        activity.setInvoice(invoice);
        activity.setSessionPackage(sessionPackage);
        activity.setActivityType(type);
        activity.setAmount(amount);
        activity.setFromValue(fromValue);
        activity.setToValue(toValue);
        activity.setReason(reason);
        activity.setExternalReference(externalReference);
        activity.setActor(actor);
        activityRepository.save(activity);
    }

    public List<AccountActivityResponse> activities(StudentInvoice invoice) {
        return activitiesFor(invoice).stream()
                .map(activity -> new AccountActivityResponse(
                        activity.getId(), activity.getActivityType(), activity.getAmount(),
                        activity.getFromValue(), activity.getToValue(), activity.getReason(),
                        activity.getExternalReference(), activity.getActor().getName(), activity.getCreatedAt()
                ))
                .toList();
    }

    public List<AccountTimelineEventResponse> timeline(
            StudentInvoice invoice,
            List<ManualPaymentSubmission> manualPayments
    ) {
        List<AccountTimelineEventResponse> events = new ArrayList<>();
        events.add(new AccountTimelineEventResponse(
                "invoice-" + invoice.getId(), "INVOICE_CREATED", "Invoice created",
                invoice.getTitle(), charges(invoice).subtract(credits(invoice)),
                invoice.getInvoiceNumber(), invoice.getCreatedByAdmin().getName(), invoice.getCreatedAt()
        ));
        appendPaymentEvents(events, invoice);
        appendManualPaymentEvents(events, invoice, manualPayments);
        appendActivityEvents(events, invoice);
        events.sort(Comparator.comparing(AccountTimelineEventResponse::occurredAt).reversed());
        return events;
    }

    private void appendPaymentEvents(List<AccountTimelineEventResponse> events, StudentInvoice invoice) {
        for (PaymentTransaction transaction : invoice.getTransactions()) {
            if (transaction.getStatus() == PaymentStatus.REFUNDED) continue;
            String title = transaction.getStatus() == PaymentStatus.SUCCEEDED
                    ? "Payment received"
                    : "Payment failed";
            events.add(new AccountTimelineEventResponse(
                    "transaction-" + transaction.getId(), "PAYMENT_" + transaction.getStatus(), title,
                    transaction.getProvider().replace('_', ' '), transaction.getAmount(),
                    transaction.getProviderReference(), null, transaction.getOccurredAt()
            ));
        }
    }

    private void appendManualPaymentEvents(
            List<AccountTimelineEventResponse> events,
            StudentInvoice invoice,
            List<ManualPaymentSubmission> submissions
    ) {
        for (ManualPaymentSubmission submission : submissions) {
            events.add(new AccountTimelineEventResponse(
                    "manual-submitted-" + submission.getId(), "MANUAL_PAYMENT_SUBMITTED",
                    "Payment evidence submitted",
                    submission.getMethod().name().replace('_', ' ').toLowerCase(), submission.getAmount(),
                    null, invoice.getStudent().getFullName(), submission.getSubmittedAt()
            ));
            if (submission.getStatus() != ManualPaymentStatus.PENDING && submission.getReviewedAt() != null) {
                events.add(new AccountTimelineEventResponse(
                        "manual-reviewed-" + submission.getId(), "MANUAL_PAYMENT_" + submission.getStatus(),
                        submission.getStatus() == ManualPaymentStatus.APPROVED
                                ? "Payment evidence approved"
                                : "Payment evidence declined",
                        submission.getReviewNote(), submission.getAmount(), null,
                        submission.getReviewedByAdmin() == null ? null : submission.getReviewedByAdmin().getName(),
                        submission.getReviewedAt()
                ));
            }
        }
    }

    private void appendActivityEvents(List<AccountTimelineEventResponse> events, StudentInvoice invoice) {
        for (BillingAccountActivity activity : activitiesFor(invoice)) {
            String transition = activity.getFromValue() != null && activity.getToValue() != null
                    ? activity.getFromValue() + " → " + activity.getToValue()
                    : null;
            String detail = transition == null
                    ? activity.getReason()
                    : activity.getReason() + " · " + transition;
            events.add(new AccountTimelineEventResponse(
                    "activity-" + activity.getId(), activity.getActivityType().name(),
                    title(activity.getActivityType()), detail, activity.getAmount(),
                    activity.getExternalReference(), activity.getActor().getName(), activity.getCreatedAt()
            ));
        }
    }

    private List<BillingAccountActivity> activitiesFor(StudentInvoice invoice) {
        return activityRepository.findByInvoice_IdOrderByCreatedAtDesc(invoice.getId());
    }

    private String title(AccountActivityType type) {
        return switch (type) {
            case PACKAGE_PAUSED -> "Package paused";
            case PACKAGE_RESUMED -> "Package resumed";
            case PACKAGE_EXTENDED -> "Package extended";
            case PACKAGE_TRANSFERRED -> "Remaining lessons transferred";
            case PACKAGE_CANCELLED -> "Package cancelled";
            case CREDIT_ADJUSTMENT -> "Account credit added";
            case REFUND_ISSUED -> "External refund recorded";
            case PAYMENT_REVERSED -> "Payment entry reversed";
        };
    }
}
