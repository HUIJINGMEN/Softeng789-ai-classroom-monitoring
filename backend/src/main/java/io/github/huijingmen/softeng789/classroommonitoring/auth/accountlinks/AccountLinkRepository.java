package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface AccountLinkRepository extends JpaRepository<AccountLink, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from AccountLink l where l.state = 'REQUESTED' order by l.createdAt, l.id")
    List<AccountLink> nextRequests(Pageable page);

    Optional<AccountLink> findByCredentialDigest(String digest);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from AccountLink l where l.credentialDigest = :digest")
    Optional<AccountLink> lockProof(String digest);

    @Modifying
    @Query("delete from AccountLink l where l.expiresAt <= :now")
    int deleteExpired(Instant now);
}
