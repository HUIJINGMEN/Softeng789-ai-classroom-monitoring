package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class InvoiceStatusPolicyTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 18);

    @Test
    void attentionCountsUseDerivedStatusAndDoNotTreatCancelledInvoicesAsOutstanding() {
        assertThat(InvoiceStatusPolicy.needsPaymentAction(null)).isTrue();
        for (InvoiceStatus stored : InvoiceStatus.values()) {
            for (int paid : new int[]{0, 20, 100}) {
                InvoiceStatus current = InvoiceStatusPolicy.resolve(stored, TODAY.minusDays(1),
                        BigDecimal.valueOf(100 - paid), BigDecimal.valueOf(paid), TODAY);
                assertThat(InvoiceStatusPolicy.needsPaymentAction(current))
                        .isEqualTo(current != InvoiceStatus.PAID && current != InvoiceStatus.CANCELLED);
            }
        }
    }

    @Test
    void financialStatusDependsOnEvidenceRatherThanAnyOldPublishedLabel() {
        for (InvoiceStatus stored : InvoiceStatus.values()) {
            for (int offset = -1; offset <= 1; offset++) {
                for (int balanceCents : new int[]{0, 1, 10000}) {
                    for (int paidCents : new int[]{0, 1, 10000}) {
                        InvoiceStatus expected;
                        if (stored == InvoiceStatus.DRAFT || stored == InvoiceStatus.CANCELLED) expected = stored;
                        else if (balanceCents == 0) expected = InvoiceStatus.PAID;
                        else if (offset < 0) expected = InvoiceStatus.OVERDUE;
                        else expected = paidCents > 0 ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.PENDING;
                        assertThat(InvoiceStatusPolicy.resolve(stored, TODAY.plusDays(offset),
                                BigDecimal.valueOf(balanceCents, 2), BigDecimal.valueOf(paidCents, 2), TODAY))
                                .isEqualTo(expected);
                    }
                }
            }
        }
    }
}
