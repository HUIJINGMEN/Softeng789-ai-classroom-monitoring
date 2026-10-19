package io.github.huijingmen.softeng789.classroommonitoring.billing.provider;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentMethod;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.server.ResponseStatusException;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.provider.PaymentCollectionPolicy.CheckoutMode.DEMO;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.provider.PaymentCollectionPolicy.CheckoutMode.MANUAL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PaymentCollectionPolicyTest {
    @Test
    void manualModeAdvertisesOnlyBankAndCashAndDeniesDirectProviderCalls() {
        var policy = new PaymentCollectionPolicy(MANUAL, new MockEnvironment());
        assertThat(policy.methods()).containsExactly(StudentPaymentMethod.BANK_TRANSFER, StudentPaymentMethod.CASH);
        assertThat(policy.demoEnabled()).isFalse();
        assertThatThrownBy(() -> new DemoPaymentProvider(policy).collect(UUID.randomUUID(), BigDecimal.TEN, "NZD"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode().value()).isEqualTo(403));
    }

    @Test
    void demoRequiresItsExplicitProfileAndCannotBeEnabledAlongsideEitherProductionName() {
        for (String[] profiles : new String[][]{{}, {"postgres"}, {"production", "payment-demo"}, {"prod", "payment-demo"}}) {
            var environment = new MockEnvironment();
            environment.setActiveProfiles(profiles);
            assertThatThrownBy(() -> new PaymentCollectionPolicy(DEMO, environment))
                    .isInstanceOf(IllegalStateException.class).hasMessageContaining("forbidden in production");
        }
    }

    @Test
    void explicitLocalDemoIsLabelledAndStillReturnsOnlyADemoReceipt() {
        var environment = new MockEnvironment();
        environment.setActiveProfiles("postgres", "payment-demo");
        var policy = new PaymentCollectionPolicy(DEMO, environment);
        assertThat(policy.methods()).contains(StudentPaymentMethod.DEMO_CHECKOUT);
        var receipt = new DemoPaymentProvider(policy).collect(UUID.randomUUID(), BigDecimal.TEN, "NZD");
        assertThat(receipt.provider()).isEqualTo("DEMO");
    }
}
