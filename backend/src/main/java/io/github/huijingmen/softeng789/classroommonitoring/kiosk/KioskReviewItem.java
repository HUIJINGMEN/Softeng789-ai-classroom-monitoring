package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "kiosk_review_items")
public class KioskReviewItem {
    @Id UUID id;
    @Column(nullable = false, unique = true) UUID attemptId;
    @Column(nullable = false) String kind;
    @Column(nullable = false) String state;
    @Column(nullable = false) Instant createdAt;
    String resolution;
    @Column(length = 500) String note;
    UUID resolvedBy;
    Instant resolvedAt;
}
