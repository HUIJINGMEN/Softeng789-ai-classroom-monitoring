package io.github.huijingmen.softeng789.classroommonitoring.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;

/** Independent short transactions: failed login rollback must not refund its admission slot. */
@Component
public class LoginAttemptStore {
    private static final int CONFLICT_RETRIES = 8;
    private final LoginAttemptRepository repository;
    private final TransactionTemplate transactions;

    public LoginAttemptStore(LoginAttemptRepository repository, PlatformTransactionManager manager) {
        this.repository = repository;
        transactions = new TransactionTemplate(manager);
        transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transactions.setTimeout(5);
    }

    /** Internal completion handle, never an HTTP credential or response field. */
    public record Reservation(String identityDigest, UUID windowId, Long version) { }

    public Reservation reserve(String digest, Instant now, int maximum, Duration window, Duration block) {
        return retry(() -> transactions.execute(status -> {
            var row = repository.findById(digest).orElseGet(() -> new LoginAttemptWindow(digest, now, window));
            if (!row.reserve(now, maximum, window, block)) {
                throw new ResponseStatusException(TOO_MANY_REQUESTS,
                        "Too many sign-in attempts. Please wait a few minutes and try again.");
            }
            row = repository.saveAndFlush(row);
            return new Reservation(digest, row.getWindowId(), row.getVersion());
        }));
    }

    public void recordSuccess(Reservation reservation) {
        retry(() -> transactions.execute(status -> {
            repository.findById(reservation.identityDigest()).ifPresent(row -> {
                row.clearIfUnchanged(reservation.windowId(), reservation.version());
                repository.flush();
            });
            return null;
        }));
    }

    public int deleteExpired(Instant now) {
        return transactions.execute(status -> repository.deleteExpired(now));
    }

    private <T> T retry(Supplier<T> operation) {
        for (int attempt = 0; attempt < CONFLICT_RETRIES; attempt++) {
            try {
                return operation.get();
            } catch (OptimisticLockingFailureException | DataIntegrityViolationException conflict) {
                // Every retry has a fresh persistence context/transaction, including insert races.
                if (attempt == CONFLICT_RETRIES - 1) {
                    throw new ResponseStatusException(SERVICE_UNAVAILABLE,
                            "Sign-in is busy. Please try again shortly.");
                }
            }
        }
        throw new IllegalStateException("Unreachable login admission retry state.");
    }
}
