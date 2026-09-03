package io.github.huijingmen.softeng789.classroommonitoring.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * An AI-detected candidate health/safety event awaiting teacher review — e.g. "possible fall".
 * This is deliberately never a confirmed fact: a teacher must Confirm (optionally correcting the
 * event type) or Dismiss it. Confirming produces a {@link HealthIncidentReport}; a plain manual
 * report from a teacher (no AI involved) skips this entity entirely and goes straight to a Report.
 */
@Entity
@Table(name = "health_alerts")
public class HealthAlert {
    public enum Status {
        AWAITING_REVIEW,
        CONFIRMED,
        DISMISSED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "student_id")
    private Student student;

    // Required — AI detection only ever happens inside a monitored session with a live camera
    // feed. An incident noticed outside any session (a hallway, before/after class) is exactly
    // the manual-report path and never produces a HealthAlert.
    @ManyToOne(optional = false)
    @JoinColumn(name = "session_id")
    private ClassroomSession session;

    @Column(name = "event_type", nullable = false, length = 60)
    private String eventType;

    @Column(precision = 4, scale = 3)
    private BigDecimal confidence;

    @Column(name = "detected_at", nullable = false)
    private Instant detectedAt;

    // Free text rather than a fixed enum — reserved for a future world with more than one AI
    // vendor/service; currently always "AI_SERVICE".
    @Column(nullable = false, length = 30)
    private String source = "AI_SERVICE";

    @Column(nullable = false, length = 20)
    private String status = Status.AWAITING_REVIEW.name();

    @Column(name = "evidence_url", length = 500)
    private String evidenceUrl;

    @ManyToOne
    @JoinColumn(name = "reviewed_by_teacher_id")
    private Teacher reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "teacher_notes", columnDefinition = "TEXT")
    private String teacherNotes;

    @Column(name = "action_taken", columnDefinition = "TEXT")
    private String actionTaken;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @jakarta.persistence.PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Student getStudent() {
        return student;
    }

    public void setStudent(Student student) {
        this.student = student;
    }

    public ClassroomSession getSession() {
        return session;
    }

    public void setSession(ClassroomSession session) {
        this.session = session;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public BigDecimal getConfidence() {
        return confidence;
    }

    public void setConfidence(BigDecimal confidence) {
        this.confidence = confidence;
    }

    public Instant getDetectedAt() {
        return detectedAt;
    }

    public void setDetectedAt(Instant detectedAt) {
        this.detectedAt = detectedAt;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getEvidenceUrl() {
        return evidenceUrl;
    }

    public void setEvidenceUrl(String evidenceUrl) {
        this.evidenceUrl = evidenceUrl;
    }

    public Teacher getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(Teacher reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(Instant reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getTeacherNotes() {
        return teacherNotes;
    }

    public void setTeacherNotes(String teacherNotes) {
        this.teacherNotes = teacherNotes;
    }

    public String getActionTaken() {
        return actionTaken;
    }

    public void setActionTaken(String actionTaken) {
        this.actionTaken = actionTaken;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
