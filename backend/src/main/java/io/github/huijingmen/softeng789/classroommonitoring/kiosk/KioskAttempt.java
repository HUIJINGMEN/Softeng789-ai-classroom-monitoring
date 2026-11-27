package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "kiosk_attempts", uniqueConstraints = @UniqueConstraint(columnNames = {"kiosk_session_id", "request_key"}))
public class KioskAttempt {
    @Id UUID id;
    @Version Long version;
    @Column(nullable = false) UUID kioskSessionId;
    @Column(nullable = false) UUID sessionId;
    @Column(nullable = false) UUID campusId;
    @Column(nullable = false, length = 80) String locationLabel;
    @Column(nullable = false) UUID requestKey;
    @Column(nullable = false, length = 64) String requestDigest;
    @Column(nullable = false) String state;
    @Column(length = 20) String recognitionDecision;
    @Column(nullable = false) short candidateCount;
    UUID topStudentId;
    UUID selectedStudentId;
    Short selectedRank;
    String attendanceStatus;
    @Column(length = 255) String selectedDisplayName;
    @Column(columnDefinition = "text") String qualityReasons;
    @Column(nullable = false) Instant capturedAt;
    @Column(nullable = false) Instant expiresAt;
    Instant processedAt;
    @Column(columnDefinition = "text") String encryptedCandidates;
    @Column(columnDefinition = "text") String encryptedCapture;
    boolean open() { return "AWAITING_SELECTION".equals(state); }
}
