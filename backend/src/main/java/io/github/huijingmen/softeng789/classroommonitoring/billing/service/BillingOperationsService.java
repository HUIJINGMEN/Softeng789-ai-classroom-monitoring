package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LearningEntitlementStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.SessionPackageStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentLearningEntitlement;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentSessionPackage;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.CourseOperationsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.OperationsAlertResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.OperationsDashboardResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.OperationsFinancialResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentLearningEntitlementRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentSessionPackageRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.balance;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.charges;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.credits;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.payments;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** Read-only projections for the billing operations workspace. */
@Service
public class BillingOperationsService {
    private static final String CURRENCY = "NZD";
    private static final Set<LessonCreditStatus> USABLE_CREDIT_STATUSES = Set.of(
            LessonCreditStatus.AVAILABLE,
            LessonCreditStatus.BOOKED,
            LessonCreditStatus.MAKEUP_DUE,
            LessonCreditStatus.MAKEUP_SCHEDULED
    );

    private final StudentInvoiceRepository invoiceRepository;
    private final StudentSessionPackageRepository packageRepository;
    private final StudentLearningEntitlementRepository entitlementRepository;
    private final LessonCreditRepository creditRepository;

    public BillingOperationsService(
            StudentInvoiceRepository invoiceRepository,
            StudentSessionPackageRepository packageRepository,
            StudentLearningEntitlementRepository entitlementRepository,
            LessonCreditRepository creditRepository
    ) {
        this.invoiceRepository = invoiceRepository;
        this.packageRepository = packageRepository;
        this.entitlementRepository = entitlementRepository;
        this.creditRepository = creditRepository;
    }

    @Transactional(readOnly = true)
    public OperationsDashboardResponse dashboard() {
        LocalDate today = BillingDates.today();
        return dashboard(today.withDayOfYear(1), today);
    }

    @Transactional(readOnly = true)
    public OperationsDashboardResponse dashboard(LocalDate from, LocalDate to) {
        validatePeriod(from, to);
        LocalDate today = BillingDates.today();
        LocalDate warningDate = today.plusDays(14);
        List<StudentInvoice> invoices = invoicesInPeriod(from, to);
        List<StudentSessionPackage> packages = packagesFor(invoices);
        List<OperationsAlertResponse> alerts = alerts(today, warningDate);
        List<CourseOperationsResponse> courses = coursePerformance(invoices, packages);
        return new OperationsDashboardResponse(
                financialSummary(invoices, today),
                alerts,
                courses,
                from,
                to,
                Instant.now()
        );
    }

    private void validatePeriod(LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) {
            throw new ResponseStatusException(BAD_REQUEST, "Choose a valid reporting period.");
        }
        if (to.isAfter(from.plusYears(1))) {
            throw new ResponseStatusException(BAD_REQUEST, "Reporting periods can cover at most one year.");
        }
    }

    private List<StudentInvoice> invoicesInPeriod(LocalDate from, LocalDate to) {
        return invoiceRepository.findForOperationsPeriod(
                from.atStartOfDay(BillingDates.BUSINESS_ZONE).toInstant(),
                to.plusDays(1).atStartOfDay(BillingDates.BUSINESS_ZONE).toInstant()
        ).stream().filter(invoice -> invoice.getStatus() != InvoiceStatus.DRAFT).toList();
    }

    private List<StudentSessionPackage> packagesFor(List<StudentInvoice> invoices) {
        List<UUID> invoiceIds = invoices.stream().map(StudentInvoice::getId).toList();
        return invoiceIds.isEmpty() ? List.of() : packageRepository.findByInvoice_IdIn(invoiceIds);
    }

    private OperationsFinancialResponse financialSummary(List<StudentInvoice> invoices, LocalDate today) {
        BigDecimal gross = invoices.stream()
                .flatMap(invoice -> invoice.getTransactions().stream())
                .filter(transaction -> transaction.getStatus() == PaymentStatus.SUCCEEDED)
                .map(transaction -> transaction.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refunded = invoices.stream().map(InvoiceAmounts::refunds)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal outstanding = invoices.stream()
                .filter(invoice -> invoice.getStatus().isOpen())
                .map(InvoiceAmounts::balance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal overdue = invoices.stream()
                .filter(invoice -> invoice.getStatus() == InvoiceStatus.OVERDUE
                        || invoice.getStatus().isOpen() && invoice.getDueDate().isBefore(today))
                .map(InvoiceAmounts::balance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new OperationsFinancialResponse(
                CURRENCY,
                money(gross),
                money(refunded),
                money(gross.subtract(refunded)),
                money(outstanding),
                money(overdue)
        );
    }

    private List<OperationsAlertResponse> alerts(LocalDate today, LocalDate warningDate) {
        List<OperationsAlertResponse> alerts = new ArrayList<>();
        appendOverdueAlerts(alerts, today);
        appendPackageAlerts(alerts, today, warningDate);
        appendMakeupAlerts(alerts, today, warningDate);
        appendMembershipAlerts(alerts, today, warningDate);
        alerts.sort(Comparator.comparing(
                OperationsAlertResponse::actionDate,
                Comparator.nullsLast(Comparator.naturalOrder())
        ));
        return alerts;
    }

    private void appendOverdueAlerts(List<OperationsAlertResponse> alerts, LocalDate today) {
        for (StudentInvoice invoice : invoiceRepository.findOverdueForOperations(
                List.of(InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE), today)) {
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

    private List<CourseOperationsResponse> coursePerformance(
            List<StudentInvoice> invoices,
            List<StudentSessionPackage> packages
    ) {
        Map<UUID, CourseStats> stats = new HashMap<>();
        for (StudentInvoice invoice : invoices) {
            for (StudentLearningEntitlement entitlement : invoice.getEntitlements()) {
                CourseOffering offering = entitlement.getCourseOffering();
                CourseStats item = stats.computeIfAbsent(offering.getId(), ignored -> new CourseStats(offering));
                item.addPurchase(invoice, entitlement);
            }
        }
        for (LessonCredit credit : packages.isEmpty() ? List.<LessonCredit>of() : creditsFor(packages)) {
            CourseOffering offering = reportingOffering(credit);
            CourseStats item = stats.computeIfAbsent(offering.getId(), ignored -> new CourseStats(offering));
            item.addCredit(credit);
        }
        return stats.values().stream()
                .map(CourseStats::response)
                .sorted(Comparator.comparing(CourseOperationsResponse::courseCode))
                .toList();
    }

    private List<LessonCredit> creditsFor(List<StudentSessionPackage> packages) {
        return creditRepository.findBySessionPackage_IdInOrderBySessionPackage_IdAscSequenceNumberAsc(
                packages.stream().map(StudentSessionPackage::getId).toList()
        );
    }

    private CourseOffering reportingOffering(LessonCredit credit) {
        if (credit.getStatus() == LessonCreditStatus.USED
                || credit.getStatus() == LessonCreditStatus.COUNTED_ABSENCE) {
            if (credit.getOriginalSession() != null && credit.getOriginalSession().getCourseOffering() != null) {
                return credit.getOriginalSession().getCourseOffering();
            }
            if (credit.getCurrentSession() != null && credit.getCurrentSession().getCourseOffering() != null) {
                return credit.getCurrentSession().getCourseOffering();
            }
        }
        return credit.getSessionPackage().getCourseOffering();
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

    private static final class CourseStats {
        private final CourseOffering offering;
        private final Set<UUID> studentIds = new java.util.HashSet<>();
        private BigDecimal netReceived = BigDecimal.ZERO;
        private BigDecimal outstanding = BigDecimal.ZERO;
        private int purchased;
        private int used;

        private CourseStats(CourseOffering offering) {
            this.offering = offering;
        }

        private void addPurchase(StudentInvoice invoice, StudentLearningEntitlement entitlement) {
            studentIds.add(invoice.getStudent().getId());
            if (entitlement.getLineItem() == null) {
                netReceived = netReceived.add(payments(invoice));
                outstanding = outstanding.add(balance(invoice));
                return;
            }
            BigDecimal invoiceNet = charges(invoice).subtract(credits(invoice));
            if (invoiceNet.signum() <= 0) return;
            BigDecimal lineAmount = entitlement.getLineItem().getAmount();
            BigDecimal allocatedPaid = payments(invoice)
                    .multiply(lineAmount)
                    .divide(invoiceNet, 2, java.math.RoundingMode.HALF_UP)
                    .min(lineAmount);
            netReceived = netReceived.add(allocatedPaid);
            outstanding = outstanding.add(lineAmount.subtract(allocatedPaid).max(BigDecimal.ZERO));
        }

        private void addCredit(LessonCredit credit) {
            studentIds.add(credit.getSessionPackage().getStudent().getId());
            purchased++;
            if (credit.getStatus() == LessonCreditStatus.USED
                    || credit.getStatus() == LessonCreditStatus.COUNTED_ABSENCE) {
                used++;
            }
        }

        private CourseOperationsResponse response() {
            int utilization = purchased == 0
                    ? 0
                    : BigDecimal.valueOf(used)
                            .multiply(BigDecimal.valueOf(100))
                            .divide(BigDecimal.valueOf(purchased), 0, RoundingMode.HALF_UP)
                            .intValue();
            return new CourseOperationsResponse(
                    offering.getId(),
                    offering.getCourse().getCode(),
                    offering.getAcademicTerm(),
                    studentIds.size(),
                    money(netReceived),
                    money(outstanding),
                    purchased,
                    used,
                    utilization
            );
        }
    }
}
