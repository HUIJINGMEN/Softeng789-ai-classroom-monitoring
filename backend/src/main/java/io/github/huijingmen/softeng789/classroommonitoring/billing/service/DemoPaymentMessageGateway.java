package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "ai.payment-message.provider", havingValue = "demo", matchIfMissing = true)
public class DemoPaymentMessageGateway implements PaymentMessageGateway {
    @Override
    public GeneratedMessage generate(Request request) {
        String attendance = attendanceSentence(request);
        String action = "NOTICE".equals(request.tone())
                ? "Please contact the office if the attendance record or invoice needs review."
                : "We are pleased to see your progress and look forward to supporting your next sessions.";
        String message = attendance + " " + action + " The balance is " + request.balance()
                + " and is due on " + request.dueDate() + ".";
        return new GeneratedMessage(message, request.tone(), "DEMO");
    }

    private String attendanceSentence(Request request) {
        if (request.purchasedSessions() == null) {
            String course = request.courseLabel() == null ? "" : " for " + request.courseLabel();
            return "This invoice is for " + request.purchaseDescription() + course + ".";
        }
        return "Your " + request.courseLabel() + " package includes " + request.purchasedSessions()
                + " sessions; " + request.attendedSessions() + " have been attended, "
                + request.chargeableAbsences() + " recorded as chargeable absences, and "
                + request.remainingSessions() + " remain.";
    }
}
