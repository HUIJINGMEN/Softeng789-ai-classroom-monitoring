package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "kiosk_sessions")
public class KioskSession {
    @Id UUID id;
    @Version Long version;
    @Column(nullable = false) UUID sessionId;
    @Column(nullable = false) UUID campusId;
    @Column(nullable = false, length = 80) String locationLabel;
    UUID launchedBy;
    @Column(nullable = false) Instant launchedAt;
    @Column(nullable = false) Instant expiresAt;
    Integer lateAfterMinutes;
    Instant lastCaptureAt;
    Instant endedAt;
    UUID endedBy;
    String endReason;
}
