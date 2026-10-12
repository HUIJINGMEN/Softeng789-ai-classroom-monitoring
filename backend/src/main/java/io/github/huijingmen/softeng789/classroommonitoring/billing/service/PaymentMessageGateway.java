package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import java.time.LocalDate;

public interface PaymentMessageGateway {
    GeneratedMessage generate(Request request);

    record Request(
            String courseLabel,
            String purchaseDescription,
            Integer purchasedSessions,
            Integer attendedSessions,
            Integer chargeableAbsences,
            Integer remainingSessions,
            String balance,
            LocalDate dueDate,
            String tone
    ) {
    }

    record GeneratedMessage(String message, String tone, String provider) {
    }
}
