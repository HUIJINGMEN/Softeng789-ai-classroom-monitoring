package io.github.huijingmen.softeng789.classroommonitoring.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** Shared admission budget; reservations count before password verification begins. */
@Entity
@Table(name = "login_attempt_windows")
public class LoginAttemptWindow {
    @Id
    @Column(name = "identity_digest", length = 64)
    private String identityDigest;
    @Column(name = "window_id", nullable = false)
    private UUID windowId;
    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;
    @Column(name = "first_attempt_at", nullable = false)
    private Instant firstAttemptAt;
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
    @Version
    @Column(nullable = false)
    private Long version;

    protected LoginAttemptWindow() { }

    public LoginAttemptWindow(String digest, Instant now, Duration window) {
        this.identityDigest = digest;
        reset(now, window);
    }

    private void reset(Instant now, Duration window) {
        windowId = UUID.randomUUID();
        attemptCount = 0;
        firstAttemptAt = now;
        expiresAt = now.plus(window);
    }

    public boolean reserve(Instant now, int maximum, Duration window, Duration block) {
        if (attemptCount == 0 || !now.isBefore(expiresAt)) reset(now, window);
        if (attemptCount >= maximum) return false;
        attemptCount++;
        // Rejected retries do not extend the block. A one-attempt configuration also blocks.
        if (attemptCount == maximum) expiresAt = now.plus(block);
        return true;
    }

    public void clearIfUnchanged(UUID expectedWindow, Long expectedVersion) {
        // A late successful request cannot erase reservations/failures admitted after it.
        if (windowId.equals(expectedWindow) && version.equals(expectedVersion)) attemptCount = 0;
    }

    public UUID getWindowId() { return windowId; }
    public Long getVersion() { return version; }
    public int getAttemptCount() { return attemptCount; }
    public String getIdentityDigest() { return identityDigest; }
}
