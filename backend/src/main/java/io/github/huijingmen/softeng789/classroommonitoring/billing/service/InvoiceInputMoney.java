package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import java.math.BigDecimal;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** Shared invoice-write boundary: creation and account adjustments must never silently round. */
final class InvoiceInputMoney {
    private static final BigDecimal MAX = new BigDecimal("9999999999.99");
    private InvoiceInputMoney() { }

    static BigDecimal require(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0 || amount.scale() > 2 || amount.compareTo(MAX) > 0) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Amounts must be positive, at most 9999999999.99, and have at most two decimal places.");
        }
        return amount.setScale(2);
    }
}
