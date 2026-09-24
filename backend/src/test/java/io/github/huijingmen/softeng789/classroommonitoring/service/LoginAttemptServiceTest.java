package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;

class LoginAttemptServiceTest {
    private MutableClock clock;
    private LoginAttemptService loginAttemptService;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-09-24T00:00:00Z"));
        loginAttemptService = new LoginAttemptService(
                3,
                Duration.ofMinutes(10),
                Duration.ofMinutes(15),
                clock
        );
    }

    @Test
    void blocksNormalizedEmailAfterConfiguredNumberOfFailures() {
        loginAttemptService.recordFailure(" Student@Example.com ");
        loginAttemptService.recordFailure("student@example.com");
        loginAttemptService.recordFailure("STUDENT@EXAMPLE.COM");

        assertThatThrownBy(() -> loginAttemptService.requireAllowed("student@example.com"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> org.assertj.core.api.Assertions.assertThat(exception.getStatusCode())
                                .isEqualTo(TOO_MANY_REQUESTS));
    }

    @Test
    void successfulLoginClearsPreviousFailures() {
        loginAttemptService.recordFailure("student@example.com");
        loginAttemptService.recordFailure("student@example.com");
        loginAttemptService.recordSuccess("student@example.com");
        loginAttemptService.recordFailure("student@example.com");

        assertThatCode(() -> loginAttemptService.requireAllowed("student@example.com"))
                .doesNotThrowAnyException();
    }

    @Test
    void allowsAnotherAttemptAfterBlockExpires() {
        loginAttemptService.recordFailure("student@example.com");
        loginAttemptService.recordFailure("student@example.com");
        loginAttemptService.recordFailure("student@example.com");
        clock.advance(Duration.ofMinutes(15));

        assertThatCode(() -> loginAttemptService.requireAllowed("student@example.com"))
                .doesNotThrowAnyException();
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        private void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
