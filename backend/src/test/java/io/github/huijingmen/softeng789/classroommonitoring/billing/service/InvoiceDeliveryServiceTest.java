package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.DeliverInvoiceRequest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InvoiceDeliveryServiceTest {

    @Test
    void preparationFailureCanRetryAndNeverReachesEmail() {
        Fixture fixture = fixture("SENT");
        doThrow(new IllegalStateException("database unavailable")).when(fixture.documentService)
                .recordReviewedMessage(fixture.invoiceId, "Reviewed message.");
        assertThatThrownBy(() -> fixture.service.email(fixture.invoiceId,
                new DeliverInvoiceRequest("Reviewed message.", "delivery-1"))).isInstanceOf(IllegalStateException.class);
        verify(fixture.documentService).recordDeliveryFailed(fixture.invoiceId, "delivery-1");
        verify(fixture.documentService, never()).recordDeliverySending(any(), any());
    }

    @Test
    void databaseFailureAfterSmtpAcceptanceNeverEnablesAutomaticResend() {
        Fixture fixture = fixture("SENT");
        when(fixture.documentService.recordDeliverySucceeded(fixture.invoiceId, "delivery-1", "SENT"))
                .thenThrow(new IllegalStateException("receipt persistence unavailable"));
        var response = fixture.service.email(fixture.invoiceId, new DeliverInvoiceRequest("Reviewed message.", "delivery-1"));
        assertThat(response.status()).isEqualTo("UNKNOWN");
        assertThat(response.message()).contains("Do not send again");
        verify(fixture.documentService).recordDeliverySending(fixture.invoiceId, "delivery-1");
        verify(fixture.documentService).recordDeliveryUnknown(fixture.invoiceId, "delivery-1");
        verify(fixture.documentService, never()).recordDeliveryFailed(any(), any());
    }

    @Test
    void unconfirmedProviderResponseIsNotReportedAsSent() {
        Fixture fixture = fixture("FAILED");
        var response = fixture.service.email(fixture.invoiceId, new DeliverInvoiceRequest("Reviewed message.", "delivery-1"));
        assertThat(response.status()).isEqualTo("UNKNOWN");
        verify(fixture.documentService).recordDeliveryUnknown(fixture.invoiceId, "delivery-1");
        verify(fixture.publicationService, never()).publish(any());
    }

    @Test
    void demoDeliveryKeepsReviewedMessageWithoutClaimingEmailWasSent() {
        Fixture fixture = fixture("DEMO");

        var response = fixture.service.email(fixture.invoiceId, new DeliverInvoiceRequest("  Reviewed message.  ", "delivery-1"));

        verify(fixture.documentService).recordReviewedMessage(fixture.invoiceId, "Reviewed message.");
        verify(fixture.publicationService).publish(fixture.invoiceId);
        verify(fixture.documentService).recordDeliverySucceeded(fixture.invoiceId, "delivery-1", "DEMO");
        assertThat(response.status()).isEqualTo("DEMO");
        assertThat(response.emailedAt()).isNull();
    }

    @Test
    void smtpDeliveryRecordsTheExactEmailTimestamp() {
        Fixture fixture = fixture("SENT");
        Instant sentAt = Instant.parse("2026-10-05T03:00:00Z");
        when(fixture.documentService.recordDeliverySucceeded(fixture.invoiceId, "delivery-1", "SENT")).thenReturn(sentAt);

        var response = fixture.service.email(fixture.invoiceId, new DeliverInvoiceRequest("Reviewed message.", "delivery-1"));

        verify(fixture.documentService).recordReviewedMessage(fixture.invoiceId, "Reviewed message.");
        verify(fixture.publicationService).publish(fixture.invoiceId);
        verify(fixture.documentService).recordDeliverySucceeded(fixture.invoiceId, "delivery-1", "SENT");
        assertThat(response.emailedAt()).isEqualTo(sentAt);
    }

    @Test
    void repeatedDeliveryKeyDoesNotSendADuplicateEmail() {
        Fixture fixture = fixture("SENT");
        Instant sentAt = Instant.parse("2026-10-05T03:00:00Z");
        when(fixture.documentService.beginDelivery(fixture.invoiceId, "delivery-1"))
                .thenReturn(InvoiceDocumentService.DeliveryAttempt.completed("SENT", sentAt));

        var response = fixture.service.email(
                fixture.invoiceId,
                new DeliverInvoiceRequest("Reviewed message.", "delivery-1")
        );

        verify(fixture.documentService, never()).recordReviewedMessage(any(), any());
        verify(fixture.publicationService, never()).publish(any());
        assertThat(response.status()).isEqualTo("SENT");
        assertThat(response.emailedAt()).isEqualTo(sentAt);
    }

    private Fixture fixture(String deliveryStatus) {
        UUID invoiceId = UUID.randomUUID();
        InvoiceDocumentService documentService = mock(InvoiceDocumentService.class);
        InvoicePublicationService publicationService = mock(InvoicePublicationService.class);
        InvoicePdfRenderer renderer = mock(InvoicePdfRenderer.class);
        InvoiceEmailGateway emailGateway = mock(InvoiceEmailGateway.class);
        when(documentService.beginDelivery(invoiceId, "delivery-1"))
                .thenReturn(InvoiceDocumentService.DeliveryAttempt.proceed());
        InvoiceDocument document = new InvoiceDocument(
                invoiceId, "INV-2026-0042", "Learning package",
                "Test Student", "TEST-0001", "student@example.test",
                LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 20), "NZD",
                List.of(new InvoiceDocument.Item("Ten sessions", LineItemType.CHARGE, new BigDecimal("500.00"))),
                new BigDecimal("500.00"), BigDecimal.ZERO, BigDecimal.ZERO,
                new BigDecimal("500.00"), null, null, "Reviewed message.", null
        );
        when(documentService.forAdmin(invoiceId, "Reviewed message.")).thenReturn(document);
        when(renderer.render(document)).thenReturn(new byte[]{1, 2, 3});
        when(emailGateway.send(any())).thenReturn(new InvoiceEmailGateway.DeliveryResult(
                deliveryStatus, "Delivery result"
        ));
        return new Fixture(
                invoiceId,
                documentService,
                publicationService,
                new InvoiceDeliveryService(documentService, publicationService, renderer, emailGateway)
        );
    }

    private record Fixture(
            UUID invoiceId,
            InvoiceDocumentService documentService,
            InvoicePublicationService publicationService,
            InvoiceDeliveryService service
    ) {
    }
}
