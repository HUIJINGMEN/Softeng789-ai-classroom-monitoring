package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AccountLinkWorker {
    private static final Logger LOG = LoggerFactory.getLogger(AccountLinkWorker.class);
    private final AccountLinkDelivery delivery;
    private final AccountLinkMailGateway mail;
    public AccountLinkWorker(AccountLinkDelivery delivery, AccountLinkMailGateway mail) { this.delivery = delivery; this.mail = mail; }

    @Scheduled(fixedDelay = 2000, initialDelay = 60000)
    public void deliverNext() {
        if (!mail.available()) return;
        var claimed = delivery.claimNext();
        if (claimed == null) return;
        try { mail.send(claimed.email(), claimed.purpose(), claimed.link()); }
        catch (RuntimeException uncertain) {
            // Provider exceptions may contain credentials/recipient/link. Never log their text.
            LOG.warn("Account email delivery did not confirm success; automatic resend is disabled.");
        }
    }

    @Scheduled(fixedDelay = 600000, initialDelay = 600000)
    public void cleanup() { delivery.cleanup(); }
}
