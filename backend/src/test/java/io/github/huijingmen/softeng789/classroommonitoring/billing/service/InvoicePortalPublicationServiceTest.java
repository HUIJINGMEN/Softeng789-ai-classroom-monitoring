package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SaveInvoiceMessageRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.service.TeacherScopeSupport;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class InvoicePortalPublicationServiceTest {
    private final TeacherScopeSupport access = mock(TeacherScopeSupport.class);
    private final InvoiceDocumentService documents = mock(InvoiceDocumentService.class);
    private final InvoicePublicationService publication = mock(InvoicePublicationService.class);
    private final StudentInvoiceRepository invoices = mock(StudentInvoiceRepository.class);
    private final UUID adminId = UUID.randomUUID();
    private final UUID invoiceId = UUID.randomUUID();
    private final Teacher admin = new Teacher();
    private final InvoicePortalPublicationService service = new InvoicePortalPublicationService(access, documents, publication, invoices);

    private void eligible(InvoiceStatus status) {
        when(access.requireCallerForWrite(adminId)).thenReturn(admin);
        when(access.isAdmin(admin)).thenReturn(true);
        var invoice = new StudentInvoice(); invoice.setStatus(status);
        when(invoices.findByIdForUpdate(invoiceId)).thenReturn(Optional.of(invoice));
    }

    @Test void publicationRecordsReviewBeforeMakingADraftVisibleWithoutAnyEmailDependency() {
        eligible(InvoiceStatus.DRAFT);
        service.publish(adminId, invoiceId, new SaveInvoiceMessageRequest("Checked message", true));
        var order = inOrder(access, invoices, documents, publication);
        order.verify(access).requireCallerForWrite(adminId);
        order.verify(access).isAdmin(admin);
        order.verify(invoices).findByIdForUpdate(invoiceId);
        order.verify(documents).recordReviewedMessage(invoiceId, "Checked message");
        order.verify(publication).publish(invoiceId);
        verifyNoMoreInteractions(documents, publication);
    }

    @Test void nonAdminCannotReadOrMutateAnInvoice() {
        when(access.requireCallerForWrite(adminId)).thenReturn(admin);
        assertThatThrownBy(() -> service.publish(adminId, invoiceId, new SaveInvoiceMessageRequest("Text", true)))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(invoices, documents, publication);
    }

    @Test void unreviewedMessageCannotPublish() {
        eligible(InvoiceStatus.DRAFT);
        assertThatThrownBy(() -> service.publish(adminId, invoiceId, new SaveInvoiceMessageRequest("Text", false)))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(documents, publication);
    }

    @Test void retryDoesNotOverwriteAnAlreadyPublishedMessage() {
        eligible(InvoiceStatus.PENDING);
        service.publish(adminId, invoiceId, new SaveInvoiceMessageRequest("Old retry text", true));
        verifyNoInteractions(documents, publication);
    }

    @Test void cancelledInvoiceCannotBeReopenedByPublication() {
        eligible(InvoiceStatus.CANCELLED);
        assertThatThrownBy(() -> service.publish(adminId, invoiceId, new SaveInvoiceMessageRequest("Text", true)))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(documents, publication);
    }

    @Test void reviewFailureNeverReachesPublication() {
        eligible(InvoiceStatus.DRAFT);
        doThrow(new IllegalStateException("database failure")).when(documents).recordReviewedMessage(invoiceId, "Text");
        assertThatThrownBy(() -> service.publish(adminId, invoiceId, new SaveInvoiceMessageRequest("Text", true)))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(publication);
    }
}
