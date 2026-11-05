package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "kiosk_evidence")
public class KioskEvidence {
    @Id UUID attemptId;
    @Column(nullable = false) String contentType;
    @Column(nullable = false, columnDefinition = "text") String encryptedImage;
    @Column(nullable = false) Instant capturedAt;
    @Column(nullable = false) Instant deleteAfter;
}
