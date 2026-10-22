package io.github.huijingmen.softeng789.classroommonitoring.feedback;

import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/** Fast failure-path tests complement the database/concurrency tests of the actual store. */
class FeedbackEmailOrchestrationTest {
    private final FeedbackEmailDeliveryStore store = mock(FeedbackEmailDeliveryStore.class);
    private final ReportEmailGateway gateway = mock(ReportEmailGateway.class);
    private final FeedbackSummaryEmailService service = new FeedbackSummaryEmailService(store, gateway);
    private final UUID id = UUID.randomUUID();
    private final UUID caller = UUID.randomUUID();
    private final ReportEmailGateway.EmailMessage message = new ReportEmailGateway.EmailMessage(
            id, "student@example.test", "Student", "TEST", "2026",
            LocalDate.of(2026, 1, 1), LocalDate.of(2026, 10, 1), "Reviewed", "Strength", "Next step");
    private final FeedbackEmailDeliveryStore.Claim claim = new FeedbackEmailDeliveryStore.Claim(
            "revision", Instant.parse("2026-10-01T00:00:00Z"), message, null);

    @BeforeEach
    void arrangeClaim() {
        when(store.claim(id, caller)).thenReturn(claim);
    }

    @Test
    void deliveryOccursBetweenCommittedClaimAndCompletion() {
        var sent = new ReportEmailGateway.DeliveryResult("SENT", "Sent");
        when(gateway.send(message)).thenReturn(sent);

        assertThat(service.deliver(id, caller).status()).isEqualTo("SENT");

        var order = inOrder(store, gateway);
        order.verify(store).claim(id, caller);
        order.verify(gateway).send(message);
        order.verify(store).complete(id, claim, sent);
        order.verifyNoMoreInteractions();
    }

    @Test
    void claimFailureCannotSendAnything() {
        when(store.claim(id, caller)).thenThrow(new IllegalStateException("Claim not committed"));
        assertThatThrownBy(() -> service.deliver(id, caller)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(gateway);
        verify(store, never()).complete(any(), any(), any());
    }

    @Test
    void existingReceiptIsReadWithoutSendingOrCompletingAgain() {
        var previous = new ReportEmailGateway.DeliveryResult("SENT", "Already sent");
        when(store.claim(id, caller)).thenReturn(new FeedbackEmailDeliveryStore.Claim(
                claim.key(), claim.reviewedAt(), null, previous));
        assertThat(service.deliver(id, caller).status()).isEqualTo("SENT");
        verifyNoInteractions(gateway);
        verify(store, never()).complete(any(), any(), any());
    }

    @Test
    void nullOrUnrecognizedGatewayResultsAreRecordedAsUncertain() {
        for (var result : new ReportEmailGateway.DeliveryResult[] {
                null, new ReportEmailGateway.DeliveryResult("QUEUED", "Not a delivery confirmation") }) {
            when(gateway.send(message)).thenReturn(result);
            assertThat(service.deliver(id, caller).status()).isEqualTo("UNKNOWN");
        }
        verify(store, times(2)).complete(id, claim, FeedbackEmailDeliveryStore.UNKNOWN);
    }

    @Test
    void completionFailureDoesNotRetryTheNetworkCallOrClaimSuccess() {
        var sent = new ReportEmailGateway.DeliveryResult("SENT", "Sent");
        when(gateway.send(message)).thenReturn(sent);
        doThrow(new IllegalStateException("Database unavailable")).when(store).complete(id, claim, sent);
        assertThat(service.deliver(id, caller).status()).isEqualTo("UNKNOWN");
        verify(gateway, times(1)).send(message);
    }
}
