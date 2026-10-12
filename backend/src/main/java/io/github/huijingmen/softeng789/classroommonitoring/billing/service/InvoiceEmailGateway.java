package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

public interface InvoiceEmailGateway {
    DeliveryResult send(Message message);

    record Message(
            String recipientEmail,
            String recipientName,
            String invoiceNumber,
            String subject,
            String body,
            String attachmentName,
            byte[] attachment
    ) {
    }

    record DeliveryResult(String status, String message) {
    }
}
