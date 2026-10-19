package io.github.huijingmen.softeng789.classroommonitoring.auth;

import java.time.Instant;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Retain pseudonymous rate-limit state only for its live window plus one cleanup interval. */
@Component
public class LoginAttemptCleanup {
    private final LoginAttemptStore store;

    public LoginAttemptCleanup(LoginAttemptStore store) { this.store = store; }

    @Scheduled(fixedDelay = 600_000, initialDelay = 600_000)
    public void removeExpiredWindows() { store.deleteExpired(Instant.now()); }
}
