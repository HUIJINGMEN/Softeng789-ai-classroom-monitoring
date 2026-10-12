package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.DeliverInvoiceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceDeliveryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceMessageDraftResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SaveInvoiceMessageRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SavedInvoiceMessageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.InvoiceDocumentService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.InvoiceDeliveryService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.InvoiceMessageService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class InvoiceDeliveryController {
    private final SessionAuthService sessionAuthService;
    private final InvoiceDeliveryService deliveryService;
    private final InvoiceMessageService messageService;
    private final InvoiceDocumentService documentService;

    public InvoiceDeliveryController(
            SessionAuthService sessionAuthService,
            InvoiceDeliveryService deliveryService,
            InvoiceMessageService messageService,
            InvoiceDocumentService documentService
    ) {
        this.sessionAuthService = sessionAuthService;
        this.deliveryService = deliveryService;
        this.messageService = messageService;
        this.documentService = documentService;
    }

    @GetMapping(value = "/admin/payments/{invoiceId}/invoice.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> adminInvoicePdf(
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return pdfResponse(deliveryService.adminPdf(invoiceId));
    }

    @GetMapping(value = "/students/{studentId}/payments/{invoiceId}/invoice.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> studentInvoicePdf(
            @PathVariable UUID studentId,
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireStudentSelf(authorization, studentId);
        return pdfResponse(deliveryService.studentPdf(studentId, invoiceId));
    }

    @PostMapping("/admin/payments/{invoiceId}/message-draft")
    public InvoiceMessageDraftResponse invoiceMessageDraft(
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return messageService.draft(invoiceId);
    }

    @PutMapping("/admin/payments/{invoiceId}/message-draft")
    public SavedInvoiceMessageResponse saveInvoiceMessage(
            @PathVariable UUID invoiceId,
            @Valid @RequestBody SaveInvoiceMessageRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        var saved = documentService.saveMessage(invoiceId, request.message(), request.reviewed());
        return new SavedInvoiceMessageResponse(saved.message(), saved.savedAt(), saved.reviewedAt());
    }

    @PostMapping("/admin/payments/{invoiceId}/email")
    public InvoiceDeliveryResponse emailInvoice(
            @PathVariable UUID invoiceId,
            @Valid @RequestBody DeliverInvoiceRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        sessionAuthService.requireAdmin(authorization);
        return deliveryService.email(invoiceId, request);
    }

    private ResponseEntity<byte[]> pdfResponse(InvoiceDeliveryService.PdfDownload pdf) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        "Content-Disposition",
                        ContentDisposition.attachment().filename(pdf.fileName()).build().toString()
                )
                .body(pdf.content());
    }
}
