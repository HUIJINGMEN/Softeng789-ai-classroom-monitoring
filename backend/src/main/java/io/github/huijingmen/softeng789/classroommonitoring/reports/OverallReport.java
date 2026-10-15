package io.github.huijingmen.softeng789.classroommonitoring.reports;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "overall_reports")
public class OverallReport {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false) private UUID createdById;
    @Column(nullable = false, length = 64) private String scopeKey;
    @Column(nullable = false, columnDefinition = "TEXT") private String document;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    private Instant finalizedAt;
    private String privacyReviewedBy;
    private Instant privacyReviewedAt;
    @Version private Long version;
    public UUID getId() { return id; }
    public UUID getCreatedById() { return createdById; }
    public void setCreatedById(UUID value) { createdById = value; }
    public String getScopeKey() { return scopeKey; }
    public void setScopeKey(String value) { scopeKey = value; }
    public String getDocument() { return document; }
    public void setDocument(String value) { document = value; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getFinalizedAt() { return finalizedAt; }
    public void setFinalizedAt(Instant value) { finalizedAt = value; }
    public String getPrivacyReviewedBy() { return privacyReviewedBy; }
    public void setPrivacyReviewedBy(String value) { privacyReviewedBy = value; }
    public Instant getPrivacyReviewedAt() { return privacyReviewedAt; }
    public void setPrivacyReviewedAt(Instant value) { privacyReviewedAt = value; }
    public Long getVersion() { return version; }
}
