package io.github.huijingmen.softeng789.classroommonitoring.vision;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "cv_photo_reviews", uniqueConstraints = @UniqueConstraint(columnNames = {"requested_by", "request_key"}))
public class PhotoReview {
    @Id UUID id;
    @Version Long version;
    UUID sessionId;
    UUID requestedBy;
    UUID requestKey;
    String requestDigest;
    String state;
    Instant createdAt;
    Instant expiresAt;
    Instant reviewedAt;
    UUID reviewedBy;
    @Column(columnDefinition = "text") String encryptedResult;
    @Column(columnDefinition = "text") String encryptedDecision;
    // Minimal deletion index: withdrawal must not require a working encryption key.
    @ElementCollection
    @CollectionTable(name = "cv_photo_review_subjects", joinColumns = @JoinColumn(name = "review_id"))
    @Column(name = "student_id", nullable = false)
    Set<UUID> subjectIds = new HashSet<>();

    void erasePayload() {
        encryptedResult = null;
        encryptedDecision = null;
        subjectIds.clear();
        if ("PENDING".equals(state)) state = "EXPIRED";
    }
}
