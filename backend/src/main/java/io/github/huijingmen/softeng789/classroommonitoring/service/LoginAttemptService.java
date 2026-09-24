package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;

/**
 * Small, single-instance login guard that matches the in-memory session architecture used by this
 * project. Failed attempts are tracked by normalized email, expire after a short window and are
 * cleared immediately after a successful sign-in.
 */
@Service
public class LoginAttemptService {
    private static final int CLEANUP_THRESHOLD = 1_000;

    private final int maxFailures;
    private final Duration failureWindow;
    private final Duration blockDuration;
    private final Clock clock;
    private final Map<String, AttemptState> attempts = new ConcurrentHashMap<>();

    @Autowired
    public LoginAttemptService(
            @Value("${app.auth.login-attempts.max-failures:5}") int maxFailures,
            @Value("${app.auth.login-attempts.failure-window:15m}") Duration failureWindow,
            @Value("${app.auth.login-attempts.block-duration:15m}") Duration blockDuration
    ) {
        this(maxFailures, failureWindow, blockDuration, Clock.systemUTC());
    }

    LoginAttemptService(int maxFailures, Duration failureWindow, Duration blockDuration, Clock clock) {
        if (maxFailures < 1 || failureWindow.isNegative() || failureWindow.isZero()
                || blockDuration.isNegative() || blockDuration.isZero()) {
            throw new IllegalArgumentException("Login attempt limits must be positive.");
        }
        this.maxFailures = maxFailures;
        this.failureWindow = failureWindow;
        this.blockDuration = blockDuration;
        this.clock = clock;
    }

    public void requireAllowed(String email) {
        String key = normalize(email);
        Instant now = clock.instant();
        AttemptState current = attempts.get(key);
        if (current == null) {
            return;
        }
        if (current.isExpired(now, failureWindow)) {
            attempts.remove(key, current);
            return;
        }
        if (current.isBlocked(now)) {
            throw new ResponseStatusException(
                    TOO_MANY_REQUESTS,
                    "Too many sign-in attempts. Please wait a few minutes and try again."
            );
        }
    }

    public void recordFailure(String email) {
        String key = normalize(email);
        Instant now = clock.instant();
        attempts.compute(key, (ignored, current) -> {
            if (current == null || current.isExpired(now, failureWindow)) {
                return new AttemptState(1, now, null);
            }
            int failures = current.failures() + 1;
            Instant blockedUntil = failures >= maxFailures ? now.plus(blockDuration) : null;
            return new AttemptState(failures, current.firstFailureAt(), blockedUntil);
        });
        cleanupExpiredEntries(now);
    }

    public void recordSuccess(String email) {
        attempts.remove(normalize(email));
    }

    private void cleanupExpiredEntries(Instant now) {
        if (attempts.size() < CLEANUP_THRESHOLD) {
            return;
        }
        attempts.entrySet().removeIf(entry -> entry.getValue().isExpired(now, failureWindow));
    }

    private String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private record AttemptState(int failures, Instant firstFailureAt, Instant blockedUntil) {
        private boolean isBlocked(Instant now) {
            return blockedUntil != null && now.isBefore(blockedUntil);
        }

        private boolean isExpired(Instant now, Duration failureWindow) {
            Instant expiry = blockedUntil == null ? firstFailureAt.plus(failureWindow) : blockedUntil;
            return !now.isBefore(expiry);
        }
    }
}
