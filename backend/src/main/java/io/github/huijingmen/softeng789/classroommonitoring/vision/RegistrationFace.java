package io.github.huijingmen.softeng789.classroommonitoring.vision;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Short-lived registration review material, separate from active attendance templates. */
@Entity
@Table(name = "cv_registration_faces")
public class RegistrationFace {
    @Id UUID studentId;
    @Version Long version;
    String attendanceMode;
    String state;
    Instant submittedAt;
    Instant expiresAt;
    String noticeVersion;
    @Column(columnDefinition = "text") String encryptedPayload;
    UUID reviewedBy;
    Instant reviewedAt;
}
