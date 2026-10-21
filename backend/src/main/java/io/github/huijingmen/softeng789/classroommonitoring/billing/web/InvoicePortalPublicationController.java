package io.github.huijingmen.softeng789.classroommonitoring.billing.web;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SaveInvoiceMessageRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.InvoicePortalPublicationService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
public class InvoicePortalPublicationController {
    private final SessionAuthService sessions;
    private final InvoicePortalPublicationService publication;

    public InvoicePortalPublicationController(SessionAuthService sessions, InvoicePortalPublicationService publication) {
        this.sessions = sessions; this.publication = publication;
    }

    @PostMapping("/api/admin/payments/{invoiceId}/publish")
    public void publish(@PathVariable UUID invoiceId, @Valid @RequestBody SaveInvoiceMessageRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        publication.publish(sessions.requireAdmin(authorization), invoiceId, request);
    }
}
