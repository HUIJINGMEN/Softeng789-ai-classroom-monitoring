package io.github.huijingmen.softeng789.classroommonitoring.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Only the SHA-256 digest is persisted, never the browser's session credential. */
@Entity
@Table(name = "login_sessions")
public class LoginSession {
    @Id
    @Column(name = "credential_digest", length = 64)
    private String credentialDigest;
    @Column(name = "account_id", nullable = false)
    private UUID accountId;
    @Column(nullable = false, length = 20)
    private String role;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    protected LoginSession() { }

    public LoginSession(String credentialDigest, UUID accountId, String role, Instant createdAt, Instant expiresAt) {
        this.credentialDigest = credentialDigest;
        this.accountId = accountId;
        this.role = role;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public String getCredentialDigest() { return credentialDigest; }
    public UUID getAccountId() { return accountId; }
    public String getRole() { return role; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
}
