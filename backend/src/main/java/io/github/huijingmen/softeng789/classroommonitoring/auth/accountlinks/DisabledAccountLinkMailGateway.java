package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.auth.account-email.provider", havingValue = "disabled", matchIfMissing = true)
public class DisabledAccountLinkMailGateway implements AccountLinkMailGateway {
    public boolean available() { return false; }
    public void send(String email, AccountLinkPurpose purpose, String link) {
        throw new IllegalStateException("Account email is disabled; no activation/reset message was sent.");
    }
}
