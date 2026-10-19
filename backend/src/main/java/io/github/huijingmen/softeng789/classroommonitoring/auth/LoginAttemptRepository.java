package io.github.huijingmen.softeng789.classroommonitoring.auth;

import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface LoginAttemptRepository extends JpaRepository<LoginAttemptWindow, String> {
    @Modifying
    @Query("delete from LoginAttemptWindow w where w.expiresAt <= :now")
    int deleteExpired(Instant now);
}
