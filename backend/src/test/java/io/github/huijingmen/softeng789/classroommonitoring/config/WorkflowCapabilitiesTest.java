package io.github.huijingmen.softeng789.classroommonitoring.config;

import io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks.DisabledAccountLinkMailGateway;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.assertj.core.api.Assertions.assertThat;

class WorkflowCapabilitiesTest {
    @Test void localDefaultsExposeNoRealMailButAllowAssistedActivation() {
        var value = new WorkflowCapabilities(new MockEnvironment(), new DisabledAccountLinkMailGateway()).current();
        assertThat(value.accountEmail()).isFalse();
        assertThat(value.reportEmail()).isFalse();
        assertThat(value.invoiceEmail()).isFalse();
        assertThat(value.assistedActivation()).isTrue();
    }

    @Test void productionAndItsAliasAlwaysDisableManualIssuance() {
        for (String profile : new String[]{"production", "prod"}) {
            var environment = new MockEnvironment(); environment.setActiveProfiles("postgres", profile);
            assertThat(new WorkflowCapabilities(environment, new DisabledAccountLinkMailGateway())
                    .assistedActivation()).isFalse();
        }
    }

    @Test void DemoCannotMasqueradeAsConfiguredSmtp() {
        var environment = new MockEnvironment().withProperty("app.invoice-email.provider", "smtp")
                .withProperty("app.report-email.provider", "demo");
        var value = new WorkflowCapabilities(environment, new DisabledAccountLinkMailGateway()).current();
        assertThat(value.invoiceEmail()).isTrue();
        assertThat(value.reportEmail()).isFalse();
    }
}
