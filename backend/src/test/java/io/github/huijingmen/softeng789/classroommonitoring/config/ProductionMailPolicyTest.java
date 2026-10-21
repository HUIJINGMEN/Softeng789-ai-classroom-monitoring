package io.github.huijingmen.softeng789.classroommonitoring.config;

import io.github.huijingmen.softeng789.classroommonitoring.billing.provider.PaymentCollectionPolicy;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentMethod;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class ProductionMailPolicyTest {
    // No application scan, datasource or JavaMailSender: these tests cannot connect or send mail.
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withUserConfiguration(ProductionMailPolicy.class, PaymentCollectionPolicy.class);

    private ApplicationContextRunner configured(String profile) {
        return runner.withPropertyValues(
                "spring.profiles.active=" + profile,
                "spring.mail.host=smtp.school.ac.nz",
                "spring.mail.port=587",
                "spring.mail.username=mail-user",
                "spring.mail.password=test-only-never-used",
                "app.report-email.from=reports@school.ac.nz",
                "app.invoice-email.from=fees@school.ac.nz",
                "app.auth.account-email.from=accounts@school.ac.nz"
        );
    }

    @Test
    void productionAndItsAliasLoadTheDatabaseProfileAndStrictRealMailDefaults() {
        for (String profile : new String[]{"production", "prod"}) {
            configured(profile).run(context -> {
                assertThat(context).hasNotFailed().hasSingleBean(ProductionMailPolicy.class);
                assertThat(context.getEnvironment().getActiveProfiles()).contains("production", "postgres");
                assertThat(context.getBean(PaymentCollectionPolicy.class).methods())
                        .containsExactly(StudentPaymentMethod.BANK_TRANSFER, StudentPaymentMethod.CASH);
                assertThat(context.getEnvironment().getProperty("app.report-email.provider")).isEqualTo("smtp");
                var mailProperties = org.springframework.boot.context.properties.bind.Binder.get(context.getEnvironment())
                        .bind("spring.mail.properties", org.springframework.boot.context.properties.bind.Bindable
                                .mapOf(String.class, String.class)).orElseThrow(IllegalStateException::new);
                assertThat(mailProperties).containsEntry("mail.smtp.auth", "true")
                        .containsEntry("mail.smtp.starttls.required", "true")
                        .containsEntry("mail.smtp.ssl.checkserveridentity", "true");
            });
        }
    }

    @Test
    void incompleteProductionConfigurationFailsInsteadOfFallingBackToDemo() {
        runner.withPropertyValues("spring.profiles.active=production").run(context -> assertThat(context).hasFailed());
        String[] invalid = {
                "app.report-email.provider=demo", "app.invoice-email.provider=demo",
                "app.auth.account-email.provider=disabled", "app.auth.account-email.from=",
                "app.report-email.from=no-reply@classroomiq.local", "app.invoice-email.from=invalid",
                "spring.mail.host=", "spring.mail.username=", "spring.mail.password=",
                "spring.mail.port=0", "spring.mail.properties.mail.smtp.auth=false",
                "spring.mail.properties.mail.smtp.starttls.enable=false",
                "spring.mail.properties.mail.smtp.starttls.required=false",
                "spring.mail.properties.mail.smtp.ssl.checkserveridentity=false",
                "spring.mail.ssl.verify-hostname=false", "spring.mail.properties.mail.smtp.ssl.trust=*",
                "spring.mail.properties.mail.smtp.connectiontimeout=0",
                "spring.mail.properties.mail.smtp.timeout=-1",
                "spring.mail.properties.mail.smtp.writetimeout=30001",
                "spring.mail.jndi-name=mail/unchecked-session", "spring.mail.protocol=smtps"
        };
        for (String property : invalid) {
            configured("production").withPropertyValues(property).run(context -> assertThat(context).hasFailed());
        }
    }

    @Test
    void authenticatedImplicitTlsIsSupportedButDemoCheckoutIsNeverSupportedInProduction() {
        configured("production").withPropertyValues(
                "spring.mail.port=465", "spring.mail.ssl.enabled=true",
                "spring.mail.properties.mail.smtp.starttls.enable=false",
                "spring.mail.properties.mail.smtp.starttls.required=false"
        ).run(context -> assertThat(context).hasNotFailed());
        configured("production,payment-demo").withPropertyValues("app.payments.checkout-mode=DEMO")
                .run(context -> assertThat(context).hasFailed());
        runner.withPropertyValues("app.payments.checkout-mode=unknown")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void localDevelopmentDoesNotRequireProductionSmtpCredentials() {
        runner.withPropertyValues("spring.profiles.active=postgres").run(context ->
                assertThat(context).hasNotFailed().doesNotHaveBean(ProductionMailPolicy.class));
    }
}
