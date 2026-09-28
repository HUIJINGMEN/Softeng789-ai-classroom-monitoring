package io.github.huijingmen.softeng789.classroommonitoring.billing.provider;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public interface PaymentProvider {
    PaymentReceipt collect(UUID invoiceId, BigDecimal amount, String currency);

    record PaymentReceipt(String provider, String reference, Instant occurredAt) {
    }
}
