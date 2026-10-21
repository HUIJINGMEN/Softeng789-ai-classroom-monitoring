package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.provider.PaymentCollectionPolicy;
import io.github.huijingmen.softeng789.classroommonitoring.billing.provider.PaymentProvider;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class PaymentCheckoutPolicyTest {
    @Test
    void disabledCheckoutCannotReachCollectionLedgerOrAccessActivationEvenWhenCalledWithoutHttp() {
        var invoices = mock(StudentInvoiceRepository.class);
        var provider = mock(PaymentProvider.class);
        var ledger = mock(PaymentLedgerService.class);
        var packages = mock(SessionPackageService.class);
        var entitlements = mock(LearningEntitlementService.class);
        var policy = new PaymentCollectionPolicy(PaymentCollectionPolicy.CheckoutMode.MANUAL, new MockEnvironment());
        var service = new PaymentService(invoices, mock(StudentRepository.class), mock(TeacherRepository.class),
                provider, policy, ledger, mock(ManualPaymentService.class), packages, entitlements,
                mock(InvoiceDraftFactory.class), mock(AdminPaymentQueryService.class));

        assertThatThrownBy(() -> service.checkout(UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Online checkout is unavailable");
        verifyNoInteractions(invoices, provider, ledger, packages, entitlements);
    }
}
