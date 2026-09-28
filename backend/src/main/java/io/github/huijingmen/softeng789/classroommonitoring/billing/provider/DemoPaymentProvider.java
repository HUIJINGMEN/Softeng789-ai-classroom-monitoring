package io.github.huijingmen.softeng789.classroommonitoring.billing.provider;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class DemoPaymentProvider implements PaymentProvider {
    @Override
    public PaymentReceipt collect(UUID invoiceId, BigDecimal amount, String currency) {
        return new PaymentReceipt(
                "DEMO",
                "demo-" + invoiceId + "-" + UUID.randomUUID(),
                Instant.now()
        );
    }
}
