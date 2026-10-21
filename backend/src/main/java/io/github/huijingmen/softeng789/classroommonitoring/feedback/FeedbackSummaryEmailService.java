package io.github.huijingmen.softeng789.classroommonitoring.feedback;

import io.github.huijingmen.softeng789.classroommonitoring.dto.FeedbackSummaryDeliveryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import static io.github.huijingmen.softeng789.classroommonitoring.feedback.FeedbackEmailDeliveryStore.UNKNOWN;

/** Orchestrates delivery without holding a database transaction across SMTP. */
@Service
public class FeedbackSummaryEmailService {
    private final FeedbackEmailDeliveryStore store;
    private final ReportEmailGateway gateway;

    public FeedbackSummaryEmailService(FeedbackEmailDeliveryStore store, ReportEmailGateway gateway) {
        this.store = store;
        this.gateway = gateway;
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public FeedbackSummaryDeliveryResponse deliver(UUID id, UUID caller) {
        // The store proxy commits the no-resend claim before any network call.
        var claim = store.claim(id, caller);
        if (claim.previous() != null) {
            return response(claim.previous());
        }

        var result = send(claim.message());
        try {
            store.complete(id, claim, result);
        } catch (RuntimeException exception) {
            // The committed PROCESSING claim survives an outage and prevents another send.
            return response(UNKNOWN);
        }
        return response(result);
    }

    private ReportEmailGateway.DeliveryResult send(ReportEmailGateway.EmailMessage message) {
        try {
            var result = Objects.requireNonNull(gateway.send(message));
            return "SENT".equals(result.status()) || "DEMO".equals(result.status()) ? result : UNKNOWN;
        } catch (RuntimeException exception) {
            // No gateway details or recipient data in responses. A timed-out send is uncertain.
            return UNKNOWN;
        }
    }

    private static FeedbackSummaryDeliveryResponse response(ReportEmailGateway.DeliveryResult result) {
        return new FeedbackSummaryDeliveryResponse("EMAIL", result.status(), result.message());
    }
}
