package io.github.huijingmen.softeng789.classroommonitoring.config;

import io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks.AccountLinkMailGateway;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/** Non-secret workflow availability; never infer readiness from a successful Demo response. */
@Component
public class WorkflowCapabilities {
    private final Environment environment;
    private final AccountLinkMailGateway accountMail;

    public WorkflowCapabilities(Environment environment, AccountLinkMailGateway accountMail) {
        this.environment = environment;
        this.accountMail = accountMail;
    }

    public record Availability(boolean accountEmail, boolean assistedActivation,
            boolean reportEmail, boolean invoiceEmail) { }

    public Availability current() {
        return new Availability(accountMail.available(), assistedActivation(),
                smtp("app.report-email.provider"), smtp("app.invoice-email.provider"));
    }

    public boolean assistedActivation() {
        // Explicitly local only. Never provide a manual token-issuing escape hatch in production.
        return !environment.acceptsProfiles(Profiles.of("production", "prod"));
    }

    private boolean smtp(String property) {
        return "smtp".equals(environment.getProperty(property, "demo"));
    }
}
