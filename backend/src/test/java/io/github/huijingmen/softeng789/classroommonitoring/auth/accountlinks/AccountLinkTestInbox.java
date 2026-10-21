package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Test source only. No debug inbox endpoint, plaintext database column or console link exists. */
@TestConfiguration
public class AccountLinkTestInbox {
    @Bean @Primary public Inbox accountLinkInbox() { return new Inbox(); }
    public static class Inbox implements AccountLinkMailGateway {
        private final Map<String, String> tokens = new ConcurrentHashMap<>();
        private boolean fail;
        public boolean available() { return true; }
        public void send(String email, AccountLinkPurpose purpose, String link) {
            if (fail) throw new IllegalStateException("Simulated uncertain transport");
            tokens.put(email, link.substring(link.indexOf("#account-link=") + "#account-link=".length()));
        }
        public String take(String email) {
            String token = tokens.remove(email);
            if (token == null) throw new IllegalStateException("No test email captured");
            return token;
        }
        public void fail(boolean value) { fail = value; }
    }
}
