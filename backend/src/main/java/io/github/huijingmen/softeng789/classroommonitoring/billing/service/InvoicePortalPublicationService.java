package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SaveInvoiceMessageRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.TeacherScopeSupport;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/** Atomic reviewed-message publication. No PDF rendering, email gateway or delivery timestamps. */
@Service
public class InvoicePortalPublicationService {
    private final TeacherScopeSupport access;
    private final InvoiceDocumentService documents;
    private final InvoicePublicationService publication;
    private final StudentInvoiceRepository invoices;

    public InvoicePortalPublicationService(TeacherScopeSupport access, InvoiceDocumentService documents,
            InvoicePublicationService publication, StudentInvoiceRepository invoices) {
        this.access = access; this.documents = documents; this.publication = publication; this.invoices = invoices;
    }

    @Transactional
    public void publish(UUID callerId, UUID invoiceId, SaveInvoiceMessageRequest request) {
        if (!access.isAdmin(access.requireCallerForWrite(callerId))) {
            throw new ResponseStatusException(FORBIDDEN, "Only administrators can publish invoices.");
        }
        if (!request.reviewed()) throw new ResponseStatusException(BAD_REQUEST, "Review the message before publishing.");
        var invoice = invoices.findByIdForUpdate(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Invoice not found."));
        if (invoice.getStatus() == InvoiceStatus.CANCELLED) {
            throw new ResponseStatusException(CONFLICT, "A cancelled invoice cannot be published.");
        }
        // A retry after a lost response must neither republish nor overwrite a later message.
        if (invoice.getStatus() != InvoiceStatus.DRAFT) return;
        documents.recordReviewedMessage(invoiceId, request.message());
        publication.publish(invoiceId);
    }
}
