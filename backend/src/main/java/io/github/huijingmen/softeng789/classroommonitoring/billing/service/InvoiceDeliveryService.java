package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.DeliverInvoiceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceDeliveryResponse;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class InvoiceDeliveryService {
    private static final Logger LOG = LoggerFactory.getLogger(InvoiceDeliveryService.class);
    private static final String UNKNOWN_MESSAGE = "Email delivery could not be confirmed. Do not send again until "
            + "your mail administrator has checked the delivery. The reviewed message is preserved.";
    private final InvoiceDocumentService documentService;
    private final InvoicePublicationService publicationService;
    private final InvoicePdfRenderer pdfRenderer;
    private final InvoiceEmailGateway emailGateway;

    public InvoiceDeliveryService(
            InvoiceDocumentService documentService,
            InvoicePublicationService publicationService,
            InvoicePdfRenderer pdfRenderer,
            InvoiceEmailGateway emailGateway
    ) {
        this.documentService = documentService;
        this.publicationService = publicationService;
        this.pdfRenderer = pdfRenderer;
        this.emailGateway = emailGateway;
    }

    public PdfDownload adminPdf(UUID invoiceId) {
        return render(documentService.forAdmin(invoiceId, null));
    }

    public PdfDownload studentPdf(UUID studentId, UUID invoiceId) {
        return render(documentService.forStudent(studentId, invoiceId));
    }

    public InvoiceDeliveryResponse email(UUID invoiceId, DeliverInvoiceRequest request) {
        String reviewedMessage = request.message().trim();
        var attempt = documentService.beginDelivery(invoiceId, request.deliveryKey());
        if (!attempt.shouldSend()) {
            return new InvoiceDeliveryResponse(
                    attempt.completedStatus(),
                    "UNKNOWN".equals(attempt.completedStatus()) ? UNKNOWN_MESSAGE
                            : "This invoice was already delivered. No duplicate email was sent.",
                    attempt.emailedAt()
            );
        }
        boolean sending = false;
        try {
            documentService.recordReviewedMessage(invoiceId, reviewedMessage);
            InvoiceDocument invoice = documentService.forAdmin(invoiceId, reviewedMessage);
            byte[] pdf = pdfRenderer.render(invoice);
            var email = new InvoiceEmailGateway.Message(
                    invoice.studentEmail(),
                    invoice.studentName(),
                    invoice.invoiceNumber(),
                    "ClassLens invoice " + invoice.invoiceNumber(),
                    emailBody(invoice, reviewedMessage),
                    invoice.fileName(),
                    pdf
            );
            documentService.recordDeliverySending(invoiceId, request.deliveryKey());
            sending = true;
            InvoiceEmailGateway.DeliveryResult result = emailGateway.send(email);
            if (result == null || (!"SENT".equals(result.status()) && !"DEMO".equals(result.status()))) {
                return unknown(invoiceId, request.deliveryKey());
            }
            Instant sentAt = null;
            if ("SENT".equals(result.status()) || "DEMO".equals(result.status())) {
                // Demo delivery still represents the administrator's explicit approval,
                // so publish to the portal even when no external email provider is used.
                publicationService.publish(invoiceId);
                sentAt = documentService.recordDeliverySucceeded(invoiceId, request.deliveryKey(), result.status());
            }
            String message = "DEMO".equals(result.status())
                    ? "Invoice approved and published to the student portal. External email is in demo mode."
                    : result.message();
            return new InvoiceDeliveryResponse(result.status(), message, sentAt);
        } catch (RuntimeException cause) {
            if (sending) return unknown(invoiceId, request.deliveryKey());
            try { documentService.recordDeliveryFailed(invoiceId, request.deliveryKey()); }
            catch (RuntimeException recoveryFailure) {
                // PREPARING expires safely; SENDING/UNKNOWN remain durable no-resend barriers.
                LOG.warn("Could not release invoice preparation {} ({})", invoiceId,
                        recoveryFailure.getClass().getSimpleName());
            }
            throw cause;
        }
    }

    private InvoiceDeliveryResponse unknown(UUID invoiceId, String key) {
        try { documentService.recordDeliveryUnknown(invoiceId, key); }
        catch (RuntimeException failure) {
            LOG.warn("Could not record uncertain invoice delivery {} ({})", invoiceId, failure.getClass().getSimpleName());
        }
        return new InvoiceDeliveryResponse("UNKNOWN", UNKNOWN_MESSAGE, null);
    }

    private PdfDownload render(InvoiceDocument document) {
        return new PdfDownload(pdfRenderer.render(document), document.fileName());
    }

    private String emailBody(InvoiceDocument invoice, String reviewedMessage) {
        return reviewedMessage + "\n\n"
                + "Invoice: " + invoice.invoiceNumber() + "\n"
                + "Amount due: " + invoice.currency() + " " + invoice.balance().toPlainString() + "\n"
                + "Due: " + invoice.dueDate() + "\n\n"
                + "Your detailed invoice is attached and is also available in your ClassLens account.\n\n"
                + "ClassLens Student Accounts";
    }

    public record PdfDownload(byte[] content, String fileName) {
    }
}
