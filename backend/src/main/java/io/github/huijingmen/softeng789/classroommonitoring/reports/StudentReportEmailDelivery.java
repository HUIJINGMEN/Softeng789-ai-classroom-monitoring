package io.github.huijingmen.softeng789.classroommonitoring.reports;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** One durable email attempt per report revision. An uncertain SMTP outcome is never auto-retried. */
@Entity
@Table(name = "student_report_email_deliveries", uniqueConstraints =
        @UniqueConstraint(name = "uq_student_report_email_revision", columnNames = {"report_id", "report_version"}))
public class StudentReportEmailDelivery {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false) private UUID reportId;
    @Column(nullable = false) private long reportVersion;
    @Column(nullable = false, length = 20) private String status = "PROCESSING";
    @Column(nullable = false, length = 1000) private String message = "Email delivery is not yet confirmed.";
    @Column(nullable = false) private Instant createdAt = Instant.now();
    private Instant completedAt;

    protected StudentReportEmailDelivery() { }
    StudentReportEmailDelivery(UUID reportId, long reportVersion) {
        this.reportId = reportId; this.reportVersion = reportVersion;
    }
    public UUID getId() { return id; }
    String getStatus() { return status; }
    String getMessage() { return message; }
    void complete(String status, String message) {
        this.status = status; this.message = message; this.completedAt = Instant.now();
    }
}
