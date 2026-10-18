package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LineItemRequest;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class InvoiceInputMoneyTest {
    @Test
    void rejectsAmountsThatCannotBeStoredExactlyBeforeNetTotalValidation() {
        for (String invalid : List.of("0", "-1", "0.001", "99.995", "10000000000.00")) {
            assertThatThrownBy(() -> InvoiceInputMoney.require(new BigDecimal(invalid)))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("two decimal places");
        }
        var lines = List.of(new LineItemRequest("Charge", LineItemType.CHARGE, new BigDecimal("100.00")),
                new LineItemRequest("Credit", LineItemType.CREDIT, new BigDecimal("99.995")));
        assertThatThrownBy(() -> new InvoiceDraftFactory().validate(lines, List.of(), "items", "net"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void exactCentsAndDatabaseUpperBoundAreAcceptedAndZeroNetIsRejected() {
        assertThat(InvoiceInputMoney.require(new BigDecimal("9999999999.99"))).isEqualByComparingTo("9999999999.99");
        var lines = List.of(new LineItemRequest("A", LineItemType.CHARGE, new BigDecimal("0.10")),
                new LineItemRequest("B", LineItemType.CHARGE, new BigDecimal("0.20")),
                new LineItemRequest("C", LineItemType.CREDIT, new BigDecimal("0.30")));
        assertThatThrownBy(() -> new InvoiceDraftFactory().validate(lines, List.of(), "items", "net must be positive"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("net must be positive");
    }
}
