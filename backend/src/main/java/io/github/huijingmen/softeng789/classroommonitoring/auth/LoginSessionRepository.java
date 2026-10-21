package io.github.huijingmen.softeng789.classroommonitoring.auth;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

public interface LoginSessionRepository extends JpaRepository<LoginSession, String> {
    @Modifying
    @Transactional
    @Query("delete from LoginSession s where s.accountId = :id")
    void revokeAccount(UUID id);

    // Eligibility checks can run inside a read-only profile query. Revocation is a separate,
    // durable security operation so restoring an account/role cannot revive a rejected session.
    @Modifying
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Query("delete from LoginSession s where s.credentialDigest = :digest")
    void revokeCredential(String digest);

    @Modifying
    @Transactional
    @Query("delete from LoginSession s where s.expiresAt <= :now")
    void deleteExpired(Instant now);
}
