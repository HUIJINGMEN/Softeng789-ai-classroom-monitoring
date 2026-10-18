package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.*;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.assertThat;

class InvoiceCourseAllocationTest {
    @Test
    void discountsAndOutstandingAreAllocatedWithoutInventingMoney() {
        var invoice = new StudentInvoice();
        UUID first = charge(invoice, "100.00", true);
        UUID second = charge(invoice, "100.00", true);
        var paid = InvoiceCourseAllocation.allocate(invoice, new BigDecimal("150.00"));
        assertThat(paid.courses().get(first)).isEqualByComparingTo("75.00");
        assertThat(paid.courses().get(second)).isEqualByComparingTo("75.00");
        var partial = InvoiceCourseAllocation.allocate(invoice, new BigDecimal("50.00"));
        assertThat(partial.courses().values()).allSatisfy(amount -> assertThat(amount).isEqualByComparingTo("25.00"));
    }

    @Test
    void unlinkedFeesAndAmbiguousLegacyLinksStayExplicitlyUnassigned() {
        var invoice = new StudentInvoice();
        UUID course = charge(invoice, "100.00", true);
        charge(invoice, "100.00", false);
        var split = InvoiceCourseAllocation.allocate(invoice, new BigDecimal("150.00"));
        assertThat(split.courses().get(course)).isEqualByComparingTo("75.00");
        assertThat(split.unassigned()).isEqualByComparingTo("75.00");
        invoice.getEntitlements().getFirst().setLineItem(null);
        assertThat(InvoiceCourseAllocation.allocate(invoice, new BigDecimal("150.00")).courses().get(course))
                .isEqualByComparingTo("150.00");
        var ambiguous = new StudentLearningEntitlement();
        ambiguous.setCourseOffering(offering());
        invoice.addEntitlement(ambiguous);
        var unknown = InvoiceCourseAllocation.allocate(invoice, new BigDecimal("150.00"));
        assertThat(unknown.courses()).isEmpty();
        assertThat(unknown.unassigned()).isEqualByComparingTo("150.00");
    }

    @Test
    void signedCentsAlwaysReconcileAcrossRandomWeightsRefundsAndPennyRemainders() {
        var random = new Random(739);
        for (int example = 0; example < 250; example++) {
            var invoice = new StudentInvoice();
            for (int line = 0; line < 7; line++) {
                charge(invoice, BigDecimal.valueOf(1 + random.nextInt(100_000), 2).toPlainString(), line % 3 != 0);
            }
            BigDecimal amount = BigDecimal.valueOf(random.nextInt(2_000_001) - 1_000_000, 2);
            var result = InvoiceCourseAllocation.allocate(invoice, amount);
            var total = result.courses().values().stream().reduce(result.unassigned(), BigDecimal::add);
            assertThat(total).isEqualByComparingTo(amount);
            assertThat(result).isEqualTo(InvoiceCourseAllocation.allocate(invoice, amount));
        }
        var empty = InvoiceCourseAllocation.allocate(new StudentInvoice(), new BigDecimal("-0.01"));
        assertThat(empty.unassigned()).isEqualByComparingTo("-0.01");
        var equal = new StudentInvoice();
        UUID first = charge(equal, "1.00", true);
        charge(equal, "1.00", true);
        charge(equal, "1.00", true);
        var penny = InvoiceCourseAllocation.allocate(equal, new BigDecimal("-0.01"));
        assertThat(penny.courses().get(first)).isEqualByComparingTo("-0.01");
        assertThat(penny.courses().values().stream().reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo("-0.01");
    }

    @Test
    void multiplePurchasesOfOneCourseAreOneBucketAndOnePennyIsNeverDuplicated() {
        var invoice = new StudentInvoice();
        UUID first = charge(invoice, "1.00", true);
        charge(invoice, "1.00", true);
        var entitlements = invoice.getEntitlements();
        entitlements.get(1).setCourseOffering(entitlements.getFirst().getCourseOffering());
        var allocation = InvoiceCourseAllocation.allocate(invoice, new BigDecimal("0.01"));
        assertThat(allocation.courses()).hasSize(1);
        assertThat(allocation.courses().get(first)).isEqualByComparingTo("0.01");
    }

    private UUID charge(StudentInvoice invoice, String amount, boolean linked) {
        var line = new InvoiceLineItem();
        line.setAmount(new BigDecimal(amount));
        line.setType(LineItemType.CHARGE);
        invoice.addLineItem(line);
        if (!linked) return null;
        var entitlement = new StudentLearningEntitlement();
        entitlement.setCourseOffering(offering());
        entitlement.setLineItem(line);
        invoice.addEntitlement(entitlement);
        return entitlement.getCourseOffering().getId();
    }

    private CourseOffering offering() {
        var offering = new CourseOffering();
        ReflectionTestUtils.setField(offering, "id", UUID.randomUUID());
        return offering;
    }
}
