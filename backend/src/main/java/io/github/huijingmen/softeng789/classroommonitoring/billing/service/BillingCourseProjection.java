package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentLearningEntitlement;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.CourseOperationsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;

/** Pure projection: money follows invoice attribution, consumed lessons their original class. */
final class BillingCourseProjection {
    private BillingCourseProjection() { }

    static List<CourseOperationsResponse> from(
            List<StudentInvoice> invoices,
            List<LessonCredit> credits,
            Map<UUID, BillingOperationsFinancials.InvoiceMoney> invoiceMoney
    ) {
        Map<UUID, CourseStats> stats = new HashMap<>();
        for (StudentInvoice invoice : invoices) {
            Set<UUID> counted = new HashSet<>();
            for (StudentLearningEntitlement entitlement : invoice.getEntitlements()) {
                CourseOffering offering = entitlement.getCourseOffering();
                if (!counted.add(offering.getId())) continue;
                CourseStats item = stats.computeIfAbsent(offering.getId(), ignored -> new CourseStats(offering));
                var allocated = invoiceMoney.get(invoice.getId());
                item.studentIds.add(invoice.getStudent().getId());
                item.netReceived = item.netReceived.add(allocated.received().courses().getOrDefault(offering.getId(), BigDecimal.ZERO));
                item.outstanding = item.outstanding.add(allocated.outstanding().courses().getOrDefault(offering.getId(), BigDecimal.ZERO));
            }
        }
        for (LessonCredit credit : credits) {
            CourseOffering offering = reportingOffering(credit);
            CourseStats item = stats.computeIfAbsent(offering.getId(), ignored -> new CourseStats(offering));
            item.addCredit(credit);
        }
        return stats.values().stream()
                .map(CourseStats::response)
                .sorted(Comparator.comparing(CourseOperationsResponse::courseCode))
                .toList();
    }

    private static CourseOffering reportingOffering(LessonCredit credit) {
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

    private static final class CourseStats {
        private final CourseOffering offering;
        private final Set<UUID> studentIds = new HashSet<>();
        private BigDecimal netReceived = BigDecimal.ZERO;
        private BigDecimal outstanding = BigDecimal.ZERO;
        private int purchased;
        private int used;

        private CourseStats(CourseOffering offering) {
            this.offering = offering;
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
