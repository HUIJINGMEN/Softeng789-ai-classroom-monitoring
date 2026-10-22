package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LearningEntitlementStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.SessionPackageStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentLearningEntitlement;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentSessionPackage;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.OperationsAlertResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentLearningEntitlementRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentSessionPackageRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.balance;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;

/** Read-only follow-up rules, evaluated within the dashboard's snapshot transaction. */
@Component
final class BillingOperationsAlerts {
    private static final Set<LessonCreditStatus> USABLE_CREDIT_STATUSES = Set.of(
            LessonCreditStatus.AVAILABLE,
            LessonCreditStatus.BOOKED,
            LessonCreditStatus.MAKEUP_DUE,
            LessonCreditStatus.MAKEUP_SCHEDULED
    );

    private final StudentSessionPackageRepository packageRepository;
    private final StudentLearningEntitlementRepository entitlementRepository;
    private final LessonCreditRepository creditRepository;

    BillingOperationsAlerts(StudentSessionPackageRepository packageRepository,
            StudentLearningEntitlementRepository entitlementRepository, LessonCreditRepository creditRepository) {
        this.packageRepository = packageRepository;
        this.entitlementRepository = entitlementRepository;
        this.creditRepository = creditRepository;
    }

    List<OperationsAlertResponse> build(List<StudentInvoice> invoices, LocalDate today, LocalDate warningDate) {
        List<OperationsAlertResponse> alerts = new ArrayList<>();
        appendOverdueAlerts(alerts, invoices, today);
        appendPackageAlerts(alerts, today, warningDate);
        appendMakeupAlerts(alerts, today, warningDate);
        appendMembershipAlerts(alerts, today, warningDate);
        alerts.sort(Comparator.comparing(
                OperationsAlertResponse::actionDate,
                Comparator.nullsLast(Comparator.naturalOrder())
        ));
        return alerts;
    }

    private void appendOverdueAlerts(List<OperationsAlertResponse> alerts, List<StudentInvoice> invoices, LocalDate today) {
        for (StudentInvoice invoice : invoices) {
            if (InvoiceStatusPolicy.current(invoice, today) != InvoiceStatus.OVERDUE) continue;
            BigDecimal due = balance(invoice);
            if (due.signum() > 0) {
                alerts.add(alert(
                        "OVERDUE_PAYMENT", "high", "Payment overdue",
                        invoice.getInvoiceNumber() + " · due " + invoice.getDueDate(),
                        invoice, null, invoice.getDueDate(), due, null
                ));
            }
        }
    }

    private void appendPackageAlerts(
            List<OperationsAlertResponse> alerts,
            LocalDate today,
            LocalDate warningDate
    ) {
        List<StudentSessionPackage> activePackages = packageRepository.findByStatusAndServiceToGreaterThanEqual(
                SessionPackageStatus.ACTIVE, today
        );
        List<LessonCredit> activeCredits = activePackages.isEmpty()
                ? List.of()
                : creditsFor(activePackages);
        Map<UUID, Integer> remainingByPackage = new HashMap<>();
        for (LessonCredit credit : activeCredits) {
            if (USABLE_CREDIT_STATUSES.contains(credit.getStatus())) {
                remainingByPackage.merge(credit.getSessionPackage().getId(), 1, Integer::sum);
            }
        }
        for (StudentSessionPackage sessionPackage : activePackages) {
            int remaining = remainingByPackage.getOrDefault(sessionPackage.getId(), 0);
            String courseCode = sessionPackage.getCourseOffering().getCourse().getCode();
            if (remaining > 0 && remaining <= 2) {
                alerts.add(alert(
                        "LOW_LESSONS", "medium", "Lessons running low",
                        courseCode + " has " + remaining + " remaining",
                        sessionPackage.getInvoice(), sessionPackage, null, null, remaining
                ));
            }
            if (remaining > 0 && !sessionPackage.getServiceTo().isAfter(warningDate)) {
                alerts.add(alert(
                        "PACKAGE_EXPIRING", "medium", "Lesson package expiring",
                        courseCode + " expires " + sessionPackage.getServiceTo(),
                        sessionPackage.getInvoice(), sessionPackage, sessionPackage.getServiceTo(), null, remaining
                ));
            }
        }
    }

    private void appendMakeupAlerts(
            List<OperationsAlertResponse> alerts,
            LocalDate today,
            LocalDate warningDate
    ) {
        for (LessonCredit credit : creditRepository.findByStatusInAndExpiresOnBetween(
                List.of(LessonCreditStatus.MAKEUP_DUE, LessonCreditStatus.MAKEUP_SCHEDULED),
                today,
                warningDate
        )) {
            StudentSessionPackage sessionPackage = credit.getSessionPackage();
            alerts.add(alert(
                    "MAKEUP_EXPIRING", "high", "Make-up credit expiring",
                    sessionPackage.getCourseOffering().getCourse().getCode() + " · expires " + credit.getExpiresOn(),
                    sessionPackage.getInvoice(), sessionPackage, credit.getExpiresOn(), null, 1
            ));
        }
    }

    private void appendMembershipAlerts(
            List<OperationsAlertResponse> alerts,
            LocalDate today,
            LocalDate warningDate
    ) {
        List<StudentLearningEntitlement> entitlements = entitlementRepository
                .findByPurchaseModeAndStatusAndValidToBetween(
                        CoursePurchaseMode.MEMBERSHIP,
                        LearningEntitlementStatus.ACTIVE,
                        today,
                        warningDate
                );
        for (StudentLearningEntitlement entitlement : entitlements) {
            StudentInvoice invoice = entitlement.getInvoice();
            if (invoice != null) {
                alerts.add(alert(
                        "MEMBERSHIP_EXPIRING", "medium", "Membership renewal due",
                        entitlement.getCourseOffering().getCourse().getCode() + " · ends " + entitlement.getValidTo(),
                        invoice, null, entitlement.getValidTo(), null, null
                ));
            }
        }
    }

    private List<LessonCredit> creditsFor(List<StudentSessionPackage> packages) {
        return creditRepository.findBySessionPackage_IdInOrderBySessionPackage_IdAscSequenceNumberAsc(
                packages.stream().map(StudentSessionPackage::getId).toList()
        );
    }

    private OperationsAlertResponse alert(
            String type,
            String severity,
            String title,
            String detail,
            StudentInvoice invoice,
            StudentSessionPackage sessionPackage,
            LocalDate actionDate,
            BigDecimal amount,
            Integer remaining
    ) {
        CourseOffering offering = sessionPackage == null
                ? invoice.getEntitlement() == null ? null : invoice.getEntitlement().getCourseOffering()
                : sessionPackage.getCourseOffering();
        return new OperationsAlertResponse(
                type,
                severity,
                title,
                detail,
                invoice.getStudent().getId(),
                invoice.getStudent().getFullName(),
                invoice.getId(),
                sessionPackage == null ? null : sessionPackage.getId(),
                offering == null ? null : offering.getId(),
                actionDate,
                amount == null ? null : money(amount),
                remaining
        );
    }

}
