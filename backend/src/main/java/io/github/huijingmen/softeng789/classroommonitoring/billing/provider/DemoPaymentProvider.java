package io.github.huijingmen.softeng789.classroommonitoring.billing.provider;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class DemoPaymentProvider implements PaymentProvider {
    private final PaymentCollectionPolicy collectionPolicy;

    public DemoPaymentProvider(PaymentCollectionPolicy collectionPolicy) {
        this.collectionPolicy = collectionPolicy;
    }

    @Override
    public PaymentReceipt collect(UUID invoiceId, BigDecimal amount, String currency) {
        collectionPolicy.requireDemoCheckout();
        return new PaymentReceipt(
                "DEMO",
                "demo-" + invoiceId + "-" + UUID.randomUUID(),
                Instant.now()
        );
    }
}
