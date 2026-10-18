package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository.FinancialState;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InvoiceSummaryProjectionTest {
    private final LocalDate today = LocalDate.of(2026, 10, 18);

    @Test
    void legacySurplusOnOneInvoiceCannotHideDebtOnAnother() {
        var summary = InvoiceSummaryProjection.from(List.of(
                row(InvoiceStatus.PARTIALLY_PAID, "50", "100"),
                row(InvoiceStatus.PAID, "100", "0")), today);
        assertThat(summary.outstanding()).isEqualByComparingTo("100.00");
        assertThat(summary.collected()).isEqualByComparingTo("100.00");
        assertThat(summary.issued()).isEqualByComparingTo("150.00");
        assertThat(summary.collectionRate()).isEqualTo(33);
        assertThat(summary.issued()).isNotEqualByComparingTo(summary.collected().add(summary.outstanding()));
        assertThat(summary.openCount()).isEqualTo(1);
        assertThat(summary.overdueCount()).isEqualTo(1);
    }

    @Test
    void settledPercentageUsesDecimalHalfUpRoundingRatherThanFloatingPointOrSurplusCash() {
        var summary = InvoiceSummaryProjection.from(List.of(row(InvoiceStatus.PENDING, "200", "29")), today);
        assertThat(summary.collectionRate()).isEqualTo(15);
        assertThat(InvoiceSummaryProjection.from(List.of(row(InvoiceStatus.PENDING, "50", "100")), today).collectionRate()).isEqualTo(100);
        assertThat(InvoiceSummaryProjection.from(List.of(), today).collectionRate()).isZero();
    }

    @Test
    void draftsStayPrivateCancelledCashFlowsRemainAuditableAndCurrencyMixingFailsExplicitly() {
        var draft = row(InvoiceStatus.DRAFT, "100", "100");
        var cancelled = row(InvoiceStatus.CANCELLED, "100", "20");
        var summary = InvoiceSummaryProjection.from(List.of(draft, cancelled), today);
        assertThat(summary.outstanding()).isZero();
        assertThat(summary.collected()).isEqualByComparingTo("20.00");
        assertThat(summary.issued()).isZero();
        assertThat(summary.draftCount()).isEqualTo(1);
        assertThat(summary.openCount()).isZero();
        when(cancelled.getCurrency()).thenReturn("USD");
        assertThatThrownBy(() -> InvoiceSummaryProjection.from(List.of(cancelled), today))
                .hasMessageContaining("different currencies");
    }

    private FinancialState row(InvoiceStatus stored, String charges, String received) {
        var row = mock(FinancialState.class);
        when(row.getLifecycleStatus()).thenReturn(stored);
        when(row.getDueDate()).thenReturn(today.minusDays(1));
        when(row.getCurrency()).thenReturn("NZD");
        when(row.getNetCharges()).thenReturn(new BigDecimal(charges));
        when(row.getNetPayments()).thenReturn(new BigDecimal(received));
        return row;
    }
}
