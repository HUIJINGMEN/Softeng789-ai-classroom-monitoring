package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentLearningEntitlement;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BillingCourseProjectionTest {
    @Test
    void duplicateEntitlementsAndInvoicesDoNotDuplicateStudentsOrAttributedMoney() {
        var offering = offering("SOFTENG 789");
        UUID student = UUID.randomUUID();
        var first = invoice(offering, student);
        var second = invoice(offering, student);
        var result = BillingCourseProjection.from(List.of(first, second), List.of(), Map.of(
                first.getId(), amounts(offering, "12.34", "1.11"),
                second.getId(), amounts(offering, "-0.34", "0.89")));

        assertThat(result).singleElement().satisfies(row -> {
            assertThat(row.students()).isEqualTo(1);
            assertThat(row.netReceived()).isEqualByComparingTo("12.00");
            assertThat(row.outstanding()).isEqualByComparingTo("2.00");
            assertThat(row.purchasedLessons()).isZero();
            assertThat(row.usedLessons()).isZero();
            assertThat(row.utilizationPercent()).isZero();
        });
    }

    @Test
    void consumedLessonsKeepTheirOriginalClassWhileUnusedTransferredLessonsFollowThePackage() {
        var original = offering("AAA 101");
        var destination = offering("ZZZ 102");
        UUID student = UUID.randomUUID();
        var used = credit(destination, student, LessonCreditStatus.USED);
        when(used.getOriginalSession().getCourseOffering()).thenReturn(original);
        var absence = credit(destination, student, LessonCreditStatus.COUNTED_ABSENCE);
        when(absence.getOriginalSession()).thenReturn(null);
        when(absence.getCurrentSession().getCourseOffering()).thenReturn(original);
        var available = credit(destination, student, LessonCreditStatus.AVAILABLE);

        var result = BillingCourseProjection.from(List.of(), List.of(used, absence, available), Map.of());
        assertThat(result).extracting(row -> row.courseCode()).containsExactly("AAA 101", "ZZZ 102");
        assertThat(result.getFirst().purchasedLessons()).isEqualTo(2);
        assertThat(result.getFirst().usedLessons()).isEqualTo(2);
        assertThat(result.getFirst().utilizationPercent()).isEqualTo(100);
        assertThat(result.getLast().purchasedLessons()).isEqualTo(1);
        assertThat(result.getLast().usedLessons()).isZero();
        assertThat(result).allSatisfy(row -> {
            assertThat(row.students()).isEqualTo(1);
            assertThat(row.netReceived()).isZero();
            assertThat(row.outstanding()).isZero();
        });
    }

    @Test
    void emptyEvidenceHasNoInventedClassRows() {
        assertThat(BillingCourseProjection.from(List.of(), List.of(), Map.of())).isEmpty();
    }

    private CourseOffering offering(String code) {
        var offering = mock(CourseOffering.class, Answers.RETURNS_DEEP_STUBS);
        when(offering.getId()).thenReturn(UUID.randomUUID());
        when(offering.getCourse().getCode()).thenReturn(code);
        when(offering.getAcademicTerm()).thenReturn("2026");
        return offering;
    }

    private StudentInvoice invoice(CourseOffering offering, UUID student) {
        var invoice = mock(StudentInvoice.class, Answers.RETURNS_DEEP_STUBS);
        when(invoice.getId()).thenReturn(UUID.randomUUID());
        when(invoice.getStudent().getId()).thenReturn(student);
        var entitlement = mock(StudentLearningEntitlement.class);
        when(entitlement.getCourseOffering()).thenReturn(offering);
        when(invoice.getEntitlements()).thenReturn(List.of(entitlement, entitlement));
        return invoice;
    }

    private LessonCredit credit(CourseOffering offering, UUID student, LessonCreditStatus status) {
        var credit = mock(LessonCredit.class, Answers.RETURNS_DEEP_STUBS);
        when(credit.getStatus()).thenReturn(status);
        when(credit.getSessionPackage().getStudent().getId()).thenReturn(student);
        when(credit.getSessionPackage().getCourseOffering()).thenReturn(offering);
        return credit;
    }

    private BillingOperationsFinancials.InvoiceMoney amounts(CourseOffering offering, String received, String debt) {
        return new BillingOperationsFinancials.InvoiceMoney(
                new InvoiceCourseAllocation.Result(Map.of(offering.getId(), new BigDecimal(received)), BigDecimal.ZERO),
                new InvoiceCourseAllocation.Result(Map.of(offering.getId(), new BigDecimal(debt)), BigDecimal.ZERO));
    }
}
