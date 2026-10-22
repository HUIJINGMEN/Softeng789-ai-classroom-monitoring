package io.github.huijingmen.softeng789.classroommonitoring.feedback;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** A committed claim is a no-resend barrier even if the process dies during SMTP. */
@Entity
@Table(name = "feedback_email_deliveries")
public class FeedbackEmailDelivery {
    @Id @Column(length = 64) private String id;
    @Column(nullable = false) private UUID summaryId;
    @Column(nullable = false, columnDefinition = "TEXT") private String messageSnapshot;
    @Column(nullable = false, length = 20) private String status = "PROCESSING";
    @Column(nullable = false, length = 1000) private String message = "Delivery is not yet confirmed. Do not resend.";
    @Column(nullable = false) private Instant createdAt = Instant.now();
    private Instant completedAt;
    protected FeedbackEmailDelivery() { }
    FeedbackEmailDelivery(String id, UUID summaryId, String snapshot) {
        this.id = id; this.summaryId = summaryId; this.messageSnapshot = snapshot;
    }
    String status() { return status; }
    String message() { return message; }
    void complete(String state, String text) {
        status = state; message = text; completedAt = Instant.now();
    }
}
