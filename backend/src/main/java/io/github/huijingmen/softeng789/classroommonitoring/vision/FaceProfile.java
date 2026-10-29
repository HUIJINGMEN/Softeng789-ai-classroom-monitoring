package io.github.huijingmen.softeng789.classroommonitoring.vision;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** New pilot templates are independent of the legacy registration/photo store. */
@Entity
@Table(name = "cv_face_profiles")
public class FaceProfile {
    @Id UUID studentId;
    @Version Long version;
    UUID revision;
    Instant consentAt;
    Instant expiresAt;
    Instant revokedAt;
    String noticeVersion;
    @Column(columnDefinition = "text") String encryptedTemplates;
    String modelVersion;
    UUID enrolledBy;
    Instant enrolledAt;

    boolean active() { return consentAt != null && revokedAt == null && expiresAt.isAfter(Instant.now()); }
    void eraseTemplate() { encryptedTemplates = null; modelVersion = null; enrolledAt = null; enrolledBy = null; }
}
