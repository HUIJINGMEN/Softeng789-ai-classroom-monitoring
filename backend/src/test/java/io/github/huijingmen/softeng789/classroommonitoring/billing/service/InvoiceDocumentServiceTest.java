package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.TimeZone;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class InvoiceDocumentServiceTest {
    @Test
    void uncertainAttemptsBlockResendingEvenWithANewKeyAndAnOldTimestamp() {
        for (String status : new String[]{"SENDING", "UNKNOWN", "IN_PROGRESS"}) {
            var fixture = new Fixture(status, Instant.EPOCH);
            for (String key : new String[]{"original", "different"}) {
                var attempt = fixture.service.beginDelivery(fixture.id, key);
                assertThat(attempt.shouldSend()).isFalse();
                assertThat(attempt.completedStatus()).isEqualTo("UNKNOWN");
            }
            verify(fixture.repository, never()).saveAndFlush(any());
        }
    }

    @Test
    void onlyPreSendPreparationCanExpireAndBeClaimedAgain() {
        var active = new Fixture("PREPARING", Instant.now());
        assertThatThrownBy(() -> active.service.beginDelivery(active.id, "different"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("being prepared");
        var expired = new Fixture("PREPARING", Instant.EPOCH);
        assertThat(expired.service.beginDelivery(expired.id, "different").shouldSend()).isTrue();
        assertThat(expired.invoice.getLastDeliveryKey()).isEqualTo("different");
        assertThat(expired.invoice.getLastDeliveryStatus()).isEqualTo("PREPARING");
        verify(expired.repository).saveAndFlush(expired.invoice);
    }

    @Test
    void claimMustBePersistedBeforeSendingAndConfirmationMustOwnThatClaim() {
        var fixture = new Fixture("PREPARING", Instant.now());
        assertThatThrownBy(() -> fixture.service.recordDeliverySending(fixture.id, "other"))
                .isInstanceOf(ResponseStatusException.class);
        fixture.service.recordDeliverySending(fixture.id, "original");
        assertThat(fixture.invoice.getLastDeliveryStatus()).isEqualTo("SENDING");
        verify(fixture.repository).saveAndFlush(fixture.invoice);
        assertThatThrownBy(() -> fixture.service.recordDeliverySucceeded(fixture.id, "other", "SENT"))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(fixture.service.recordDeliverySucceeded(fixture.id, "original", "SENT")).isNotNull();
        assertThat(fixture.service.beginDelivery(fixture.id, "original").shouldSend()).isFalse();
    }

    @Test
    void failureRecoveryCannotClearAnUnknownOrSuccessfulAttempt() {
        var fixture = new Fixture("PREPARING", Instant.now());
        fixture.service.recordDeliveryUnknown(fixture.id, "original");
        fixture.service.recordDeliveryFailed(fixture.id, "original");
        assertThat(fixture.invoice.getLastDeliveryStatus()).isEqualTo("UNKNOWN");
        fixture.invoice.setLastDeliveryStatus("SENT");
        fixture.service.recordDeliveryUnknown(fixture.id, "original");
        fixture.service.recordDeliveryFailed(fixture.id, "original");
        assertThat(fixture.invoice.getLastDeliveryStatus()).isEqualTo("SENT");
    }

    @Test
    void missingKeysAreRejectedAndPreSendFailuresCanRetry() {
        var fixture = new Fixture("PREPARING", Instant.now());
        assertThatThrownBy(() -> fixture.service.beginDelivery(fixture.id, " "))
                .isInstanceOf(ResponseStatusException.class);
        fixture.service.recordDeliveryFailed(fixture.id, "original");
        assertThat(fixture.invoice.getLastDeliveryStatus()).isEqualTo("FAILED");
        assertThat(fixture.service.beginDelivery(fixture.id, "retry").shouldSend()).isTrue();
    }

    @Test
    void documentCreationDateUsesTheSchoolCalendarNotTheServerTimezone() {
        var fixture = new Fixture(null, Instant.now());
        Student student = mock(Student.class);
        fixture.invoice.setStudent(student);
        ReflectionTestUtils.setField(fixture.invoice, "createdAt", Instant.parse("2026-10-17T12:30:00Z"));
        TimeZone original = TimeZone.getDefault();
        try {
            for (String zone : new String[]{"UTC", "America/Los_Angeles", "Pacific/Auckland"}) {
                TimeZone.setDefault(TimeZone.getTimeZone(zone));
                assertThat(fixture.service.forAdmin(fixture.id, null).issuedDate()).isEqualTo(LocalDate.of(2026, 10, 18));
            }
        } finally {
            TimeZone.setDefault(original);
        }
    }

    private static class Fixture {
        final UUID id = UUID.randomUUID();
        final StudentInvoice invoice = new StudentInvoice();
        final StudentInvoiceRepository repository = mock(StudentInvoiceRepository.class);
        final SessionPackageService packages = mock(SessionPackageService.class);
        final InvoiceDocumentService service = new InvoiceDocumentService(repository, packages);

        Fixture(String status, Instant updatedAt) {
            ReflectionTestUtils.setField(invoice, "id", id);
            ReflectionTestUtils.setField(invoice, "updatedAt", updatedAt);
            invoice.setLastDeliveryKey("original");
            invoice.setLastDeliveryStatus(status);
            when(repository.findByIdForUpdate(id)).thenReturn(Optional.of(invoice));
            when(repository.findById(id)).thenReturn(Optional.of(invoice));
            when(packages.summarizeAllForInvoices(any())).thenReturn(Map.of());
        }
    }
}
