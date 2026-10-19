package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import io.github.huijingmen.softeng789.classroommonitoring.auth.LoginAttemptRepository;
import io.github.huijingmen.softeng789.classroommonitoring.auth.LoginAttemptStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:login-budget;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
        "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class LoginAttemptServiceTest {
    @Autowired LoginAttemptStore store;
    @Autowired LoginAttemptRepository rows;
    @Autowired PlatformTransactionManager transactions;
    private MutableClock clock;
    private LoginAttemptService loginAttemptService;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-09-24T00:00:00Z"));
        rows.deleteAll();
        loginAttemptService = service(store, 3);
    }

    private LoginAttemptService service(LoginAttemptStore owner, int maximum) {
        return new LoginAttemptService(owner, maximum, Duration.ofMinutes(10), Duration.ofMinutes(15), clock);
    }

    @Test
    void blocksNormalizedEmailAfterConfiguredNumberOfFailures() {
        loginAttemptService.beginAttempt(" Student@Example.com ");
        loginAttemptService.beginAttempt("student@example.com");
        loginAttemptService.beginAttempt("STUDENT@EXAMPLE.COM");

        assertThatThrownBy(() -> loginAttemptService.beginAttempt("student@example.com"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> org.assertj.core.api.Assertions.assertThat(exception.getStatusCode())
                                .isEqualTo(TOO_MANY_REQUESTS));
        assertThat(rows.findAll()).singleElement().satisfies(row -> {
            assertThat(row.getIdentityDigest()).hasSize(64).doesNotContain("student", "@", "example");
            assertThat(row.getAttemptCount()).isEqualTo(3);
        });
    }

    @Test
    void successfulLoginClearsPreviousFailures() {
        loginAttemptService.beginAttempt("student@example.com");
        var successful = loginAttemptService.beginAttempt("student@example.com");
        loginAttemptService.recordSuccess(successful);
        loginAttemptService.beginAttempt("student@example.com");

        assertThatCode(() -> loginAttemptService.beginAttempt("student@example.com"))
                .doesNotThrowAnyException();
    }

    @Test
    void allowsAnotherAttemptAfterBlockExpires() {
        loginAttemptService.beginAttempt("student@example.com");
        loginAttemptService.beginAttempt("student@example.com");
        loginAttemptService.beginAttempt("student@example.com");
        clock.advance(Duration.ofMinutes(14));
        assertThatThrownBy(() -> loginAttemptService.beginAttempt("student@example.com"))
                .isInstanceOf(ResponseStatusException.class);
        clock.advance(Duration.ofMinutes(1));

        assertThatCode(() -> loginAttemptService.beginAttempt("student@example.com"))
                .doesNotThrowAnyException();
    }

    @Test
    void firstFailureBlocksWhenMaximumIsOneAndReconstructionDoesNotResetBudget() {
        var firstOwner = service(store, 1);
        firstOwner.beginAttempt("student@example.com");
        var reconstructed = service(new LoginAttemptStore(rows, transactions), 1);
        assertThatThrownBy(() -> reconstructed.beginAttempt("student@example.com"))
                .isInstanceOf(ResponseStatusException.class);
        assertThatCode(() -> reconstructed.beginAttempt("another@example.com")).doesNotThrowAnyException();
    }

    @Test
    void lateSuccessCannotClearNewerFailuresOrARecreatedWindow() {
        var oldSuccess = loginAttemptService.beginAttempt("student@example.com");
        loginAttemptService.beginAttempt("student@example.com");
        loginAttemptService.beginAttempt("student@example.com");
        loginAttemptService.recordSuccess(oldSuccess);
        assertThatThrownBy(() -> loginAttemptService.beginAttempt("student@example.com"))
                .isInstanceOf(ResponseStatusException.class);
        clock.advance(Duration.ofMinutes(15));
        assertThat(store.deleteExpired(clock.instant())).isEqualTo(1);
        loginAttemptService.beginAttempt("student@example.com");
        loginAttemptService.recordSuccess(oldSuccess);
        assertThat(rows.findAll()).singleElement().satisfies(row -> assertThat(row.getAttemptCount()).isEqualTo(1));
    }

    @Test
    void expiryUsesExactBoundaryAndCleanupKeepsLiveWindows() {
        loginAttemptService.beginAttempt("old@example.com");
        clock.advance(Duration.ofMinutes(9));
        loginAttemptService.beginAttempt("live@example.com");
        clock.advance(Duration.ofMinutes(1));
        assertThat(store.deleteExpired(clock.instant())).isEqualTo(1);
        assertThat(rows.count()).isEqualTo(1);
        loginAttemptService.beginAttempt("old@example.com");
        assertThat(rows.count()).isEqualTo(2);
    }

    @Test
    void failedOuterTransactionCannotRollBackAdmission() {
        var outer = new TransactionTemplate(transactions);
        assertThatThrownBy(() -> outer.execute(status -> {
            loginAttemptService.beginAttempt("student@example.com");
            throw new IllegalStateException("password rejected");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(rows.findAll()).singleElement().satisfies(row -> assertThat(row.getAttemptCount()).isEqualTo(1));
    }

    @Test
    void concurrentOwnersCannotAdmitMoreThanTheBudget() throws Exception {
        var secondOwner = service(new LoginAttemptStore(rows, transactions), 3);
        var ready = new CountDownLatch(12);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(12)) {
            var results = new ArrayList<Future<Boolean>>();
            for (int i = 0; i < 12; i++) {
                var owner = i % 2 == 0 ? loginAttemptService : secondOwner;
                results.add(executor.submit(() -> {
                    ready.countDown();
                    assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
                    try {
                        owner.beginAttempt("racing@example.com");
                        return true;
                    } catch (ResponseStatusException rejected) {
                        assertThat(rejected.getStatusCode()).isEqualTo(TOO_MANY_REQUESTS);
                        return false;
                    }
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            int admitted = 0;
            for (var result : results) if (result.get(20, TimeUnit.SECONDS)) admitted++;
            assertThat(admitted).isEqualTo(3);
        }
        assertThat(rows.findAll()).singleElement().satisfies(row -> assertThat(row.getAttemptCount()).isEqualTo(3));
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
