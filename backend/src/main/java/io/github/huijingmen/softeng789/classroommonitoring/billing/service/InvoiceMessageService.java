package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceMessageDraftResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SessionPackageUsageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LearningEntitlementResponse;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class InvoiceMessageService {
    private final InvoiceDocumentService documentService;
    private final PaymentMessageGateway messageGateway;

    public InvoiceMessageService(
            InvoiceDocumentService documentService,
            PaymentMessageGateway messageGateway
    ) {
        this.documentService = documentService;
        this.messageGateway = messageGateway;
    }

    public InvoiceMessageDraftResponse draft(UUID invoiceId) {
        InvoiceDocument invoice = documentService.forAdmin(invoiceId, null);
        List<io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CoursePurchaseResponse> purchases =
                invoice.coursePurchases();
        List<SessionPackageUsageResponse> packages = purchases.stream()
                .map(item -> item.sessionPackage())
                .filter(java.util.Objects::nonNull)
                .toList();
        String tone = chooseTone(packages);
        PaymentMessageGateway.GeneratedMessage generated = messageGateway.generate(new PaymentMessageGateway.Request(
                courseLabel(purchases),
                purchaseDescription(purchases, invoice.title()),
                packages.isEmpty() ? null : packages.stream().mapToInt(SessionPackageUsageResponse::purchasedSessions).sum(),
                packages.isEmpty() ? null : packages.stream().mapToInt(SessionPackageUsageResponse::attendedSessions).sum(),
                packages.isEmpty() ? null : packages.stream().mapToInt(SessionPackageUsageResponse::chargeableAbsences).sum(),
                packages.isEmpty() ? null : packages.stream().mapToInt(SessionPackageUsageResponse::remainingSessions).sum(),
                invoice.currency() + " " + invoice.balance().toPlainString(),
                invoice.dueDate(),
                tone
        ));
        String reviewedDraft = "Dear " + invoice.studentName() + ",\n\n" + generated.message().trim();
        return new InvoiceMessageDraftResponse(reviewedDraft, generated.tone(), generated.provider());
    }

    private String courseLabel(
            List<io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CoursePurchaseResponse> purchases
    ) {
        if (purchases.isEmpty()) return null;
        return purchases.stream()
                .map(item -> item.entitlement().courseCode() + " · " + item.entitlement().academicTerm())
                .distinct()
                .collect(java.util.stream.Collectors.joining(", "));
    }

    private String purchaseDescription(
            List<io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CoursePurchaseResponse> purchases,
            String invoiceTitle
    ) {
        if (purchases.isEmpty()) return invoiceTitle;
        return purchases.stream().map(item -> {
            LearningEntitlementResponse entitlement = item.entitlement();
            String base = switch (entitlement.purchaseMode()) {
                case COURSE_ENROLMENT -> "Full course enrolment";
                case LESSON_PACKAGE -> "Lesson package";
                case MEMBERSHIP -> "Membership access";
                case PAY_PER_LESSON -> "Single lesson";
            };
            if (entitlement.classroomSessionDate() != null) {
                return base + " on " + entitlement.classroomSessionDate().format(
                        DateTimeFormatter.ofPattern("d MMM uuuu", Locale.ENGLISH));
            }
            return base;
        }).distinct().collect(java.util.stream.Collectors.joining(" and "));
    }

    private String chooseTone(List<SessionPackageUsageResponse> packages) {
        int purchased = packages.stream().mapToInt(SessionPackageUsageResponse::purchasedSessions).sum();
        int attended = packages.stream().mapToInt(SessionPackageUsageResponse::attendedSessions).sum();
        int absences = packages.stream().mapToInt(SessionPackageUsageResponse::chargeableAbsences).sum();
        if (purchased == 0) return "ENCOURAGE";
        boolean lowAttendance = attended * 100 < purchased * 60;
        boolean moreAbsencesThanAttendance = absences > attended;
        return lowAttendance || moreAbsencesThanAttendance ? "NOTICE" : "ENCOURAGE";
    }
}
