package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.invoice-email.provider", havingValue = "demo", matchIfMissing = true)
public class DemoInvoiceEmailGateway implements InvoiceEmailGateway {
    private static final Logger LOGGER = LoggerFactory.getLogger(DemoInvoiceEmailGateway.class);

    @Override
    public DeliveryResult send(Message message) {
        LOGGER.info("DEMO invoice email {} to {}", message.invoiceNumber(), message.recipientEmail());
        return new DeliveryResult(
                "DEMO",
                "Email delivery is in demo mode. The invoice and attachment were prepared but not sent externally."
        );
    }
}
