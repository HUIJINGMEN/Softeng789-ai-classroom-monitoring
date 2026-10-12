package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.NOT_FOUND;

/** Owns the boundary between an administrator-only invoice draft and a student-visible invoice. */
@Service
public class InvoicePublicationService {
    private final StudentInvoiceRepository invoiceRepository;

    public InvoicePublicationService(StudentInvoiceRepository invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }

    @Transactional
    public void publish(UUID invoiceId) {
        StudentInvoice invoice = invoiceRepository.findByIdForUpdate(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Invoice not found."));
        if (invoice.getStatus() != InvoiceStatus.DRAFT) return;
        invoice.setStatus(invoice.getDueDate().isBefore(BillingDates.today())
                ? InvoiceStatus.OVERDUE
                : InvoiceStatus.PENDING);
        invoiceRepository.save(invoice);
    }
}
