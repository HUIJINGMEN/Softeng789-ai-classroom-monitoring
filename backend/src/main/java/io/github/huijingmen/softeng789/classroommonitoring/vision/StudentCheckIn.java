package io.github.huijingmen.softeng789.classroommonitoring.vision;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "cv_student_checkins", uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "request_key"}))
public class StudentCheckIn {
    @Id UUID id;
    @Version Long version;
    UUID studentId;
    UUID sessionId;
    UUID requestKey;
    String requestDigest;
    String state;
    Instant createdAt;
    Instant expiresAt;
    Instant reviewedAt;
    UUID reviewedBy;
    @Column(columnDefinition = "text") String encryptedResult;

    void erasePayload() {
        encryptedResult = null;
        if ("PENDING".equals(state)) state = "EXPIRED";
    }
}
