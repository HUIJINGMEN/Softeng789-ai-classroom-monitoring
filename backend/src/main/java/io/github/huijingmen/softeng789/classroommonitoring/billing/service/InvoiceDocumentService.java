package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SessionPackageUsageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LearningEntitlementResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import java.time.ZoneId;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.balance;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.charges;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.credits;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.payments;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.CONFLICT;

@Service
public class InvoiceDocumentService {
    private final StudentInvoiceRepository invoiceRepository;
    private final SessionPackageService sessionPackageService;

    public InvoiceDocumentService(
            StudentInvoiceRepository invoiceRepository,
            SessionPackageService sessionPackageService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.sessionPackageService = sessionPackageService;
    }

    // The invoice snapshot includes a reconciled lesson package, which may persist
    // credit transitions discovered from newer attendance/session records.
    @Transactional
    public InvoiceDocument forAdmin(UUID invoiceId, String noteOverride) {
        StudentInvoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> notFound());
        return snapshot(invoice, noteOverride);
    }

    @Transactional
    public InvoiceDocument forStudent(UUID studentId, UUID invoiceId) {
        StudentInvoice invoice = invoiceRepository.findForStudent(invoiceId, studentId)
                .orElseThrow(() -> notFound());
        return snapshot(invoice, null);
    }

    @Transactional
    public void recordReviewedMessage(UUID invoiceId, String reviewedMessage) {
        StudentInvoice invoice = invoiceRepository.findByIdForUpdate(invoiceId)
                .orElseThrow(() -> notFound());
        invoice.setNote(reviewedMessage.trim());
        Instant now = Instant.now();
        invoice.setMessageDraftSavedAt(now);
        invoice.setMessageReviewedAt(now);
        invoiceRepository.save(invoice);
    }

    @Transactional
    public SavedMessage saveMessage(UUID invoiceId, String message, boolean reviewed) {
        StudentInvoice invoice = invoiceRepository.findByIdForUpdate(invoiceId)
                .orElseThrow(() -> notFound());
        Instant savedAt = Instant.now();
        invoice.setNote(message.trim());
        invoice.setMessageDraftSavedAt(savedAt);
        invoice.setMessageReviewedAt(reviewed ? savedAt : null);
        invoiceRepository.save(invoice);
        return new SavedMessage(invoice.getNote(), savedAt, invoice.getMessageReviewedAt());
    }

    @Transactional
    public DeliveryAttempt beginDelivery(UUID invoiceId, String deliveryKey) {
        if (deliveryKey == null || deliveryKey.isBlank()) return DeliveryAttempt.proceed();
        StudentInvoice invoice = invoiceRepository.findByIdForUpdate(invoiceId)
                .orElseThrow(() -> notFound());
        String key = deliveryKey.trim();
        if (key.equals(invoice.getLastDeliveryKey())) {
            if ("SENT".equals(invoice.getLastDeliveryStatus()) || "DEMO".equals(invoice.getLastDeliveryStatus())) {
                return DeliveryAttempt.completed(invoice.getLastDeliveryStatus(), invoice.getLastEmailedAt());
            }
            if ("IN_PROGRESS".equals(invoice.getLastDeliveryStatus())) {
                throw new ResponseStatusException(CONFLICT, "This invoice delivery is already in progress.");
            }
        } else if ("IN_PROGRESS".equals(invoice.getLastDeliveryStatus())) {
            throw new ResponseStatusException(CONFLICT, "Another invoice delivery is already in progress.");
        }
        invoice.setLastDeliveryKey(key);
        invoice.setLastDeliveryStatus("IN_PROGRESS");
        invoiceRepository.saveAndFlush(invoice);
        return DeliveryAttempt.proceed();
    }

    @Transactional
    public Instant recordDeliverySucceeded(UUID invoiceId, String deliveryKey, String status) {
        StudentInvoice invoice = invoiceRepository.findByIdForUpdate(invoiceId)
                .orElseThrow(() -> notFound());
        if (deliveryKey != null && !deliveryKey.isBlank()) invoice.setLastDeliveryKey(deliveryKey.trim());
        invoice.setLastDeliveryStatus(status);
        Instant emailedAt = null;
        if ("SENT".equals(status)) {
            emailedAt = Instant.now();
            invoice.setLastEmailedAt(emailedAt);
        }
        invoiceRepository.save(invoice);
        return emailedAt;
    }

    @Transactional
    public void recordDeliveryFailed(UUID invoiceId, String deliveryKey) {
        if (deliveryKey == null || deliveryKey.isBlank()) return;
        StudentInvoice invoice = invoiceRepository.findByIdForUpdate(invoiceId)
                .orElseThrow(() -> notFound());
        if (deliveryKey.trim().equals(invoice.getLastDeliveryKey())) {
            invoice.setLastDeliveryStatus("FAILED");
            invoiceRepository.save(invoice);
        }
    }

    @Transactional
    public java.time.Instant recordEmailed(UUID invoiceId) {
        StudentInvoice invoice = invoiceRepository.findByIdForUpdate(invoiceId)
                .orElseThrow(() -> notFound());
        java.time.Instant emailedAt = java.time.Instant.now();
        invoice.setLastEmailedAt(emailedAt);
        invoiceRepository.save(invoice);
        return emailedAt;
    }

    private InvoiceDocument snapshot(StudentInvoice invoice, String noteOverride) {
        List<SessionPackageUsageResponse> sessionPackages = sessionPackageService
                .summarizeAllForInvoices(List.of(invoice.getId()))
                .getOrDefault(invoice.getId(), List.of());
        var response = PaymentResponseMapper.toInvoice(invoice, List.of(), sessionPackages);
        String note = noteOverride == null ? invoice.getNote() : noteOverride.trim();
        return new InvoiceDocument(
                invoice.getId(),
                invoice.getInvoiceNumber(),
                invoice.getTitle(),
                invoice.getStudent().getFullName(),
                invoice.getStudent().getStudentNumber(),
                invoice.getStudent().getUniversityEmail(),
                invoice.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDate(),
                invoice.getDueDate(),
                invoice.getCurrency(),
                invoice.getLineItems().stream()
                        .map(item -> new InvoiceDocument.Item(
                                item.getDescription(), item.getType(), item.getAmount()
                        ))
                        .toList(),
                charges(invoice),
                credits(invoice),
                payments(invoice),
                balance(invoice),
                response.entitlement(),
                response.sessionPackage(),
                response.coursePurchases(),
                note,
                invoice.getLastEmailedAt()
        );
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(NOT_FOUND, "Invoice not found.");
    }

    public record SavedMessage(String message, Instant savedAt, Instant reviewedAt) {
    }

    public record DeliveryAttempt(boolean shouldSend, String completedStatus, Instant emailedAt) {
        static DeliveryAttempt proceed() { return new DeliveryAttempt(true, null, null); }
        static DeliveryAttempt completed(String status, Instant emailedAt) {
            return new DeliveryAttempt(false, status, emailedAt);
        }
    }
}
