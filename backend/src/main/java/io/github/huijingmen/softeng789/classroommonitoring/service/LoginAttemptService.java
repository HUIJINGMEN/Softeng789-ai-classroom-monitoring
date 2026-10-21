package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.auth.LoginAttemptStore;
import io.github.huijingmen.softeng789.classroommonitoring.auth.LoginAttemptStore.Reservation;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Shared account budget. Admission is committed before password verification; a late success may
 * clear only its unchanged window, never newer failures. No client forwarding header is trusted.
 */
@Service
public class LoginAttemptService {
    private final LoginAttemptStore store;
    private final int maxFailures;
    private final Duration failureWindow;
    private final Duration blockDuration;
    private final Clock clock;

    @Autowired
    public LoginAttemptService(
            LoginAttemptStore store,
            @Value("${app.auth.login-attempts.max-failures:5}") int maxFailures,
            @Value("${app.auth.login-attempts.failure-window:15m}") Duration failureWindow,
            @Value("${app.auth.login-attempts.block-duration:15m}") Duration blockDuration
    ) {
        this(store, maxFailures, failureWindow, blockDuration, Clock.systemUTC());
    }

    LoginAttemptService(LoginAttemptStore store, int maxFailures, Duration failureWindow,
            Duration blockDuration, Clock clock) {
        if (maxFailures < 1 || failureWindow.isNegative() || failureWindow.isZero()
                || blockDuration.isNegative() || blockDuration.isZero()) {
            throw new IllegalArgumentException("Login attempt limits must be positive.");
        }
        this.store = store;
        this.maxFailures = maxFailures;
        this.failureWindow = failureWindow;
        this.blockDuration = blockDuration;
        this.clock = clock;
    }

    public Reservation beginAttempt(String email) {
        return store.reserve(identityDigest(email), clock.instant(), maxFailures, failureWindow, blockDuration);
    }

    public void recordSuccess(Reservation reservation) {
        store.recordSuccess(reservation);
    }

    private String identityDigest(String email) {
        String normalized = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(normalized.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is required for login admission.", impossible);
        }
    }
}
