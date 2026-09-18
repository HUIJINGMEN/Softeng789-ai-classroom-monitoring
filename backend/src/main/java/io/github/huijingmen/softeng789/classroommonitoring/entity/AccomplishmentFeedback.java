package io.github.huijingmen.softeng789.classroommonitoring.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** An immutable-in-purpose student response to a published accomplishment. Acknowledgements are
 * recorded once; correction requests retain their own review outcome so the conversation remains
 * auditable even when a student submits a later request. */
@Entity
@Table(name = "accomplishment_feedback")
public class AccomplishmentFeedback {
    public enum Type {
        ACKNOWLEDGEMENT,
        CORRECTION_REQUEST
    }

    public enum Status {
        RECORDED,
        PENDING,
        ACCEPTED,
        DECLINED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "accomplishment_id", nullable = false)
    private Accomplishment accomplishment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private Type type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "staff_response", columnDefinition = "TEXT")
    private String staffResponse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_teacher_id")
    private Teacher reviewedByTeacher;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Accomplishment getAccomplishment() { return accomplishment; }
    public void setAccomplishment(Accomplishment accomplishment) { this.accomplishment = accomplishment; }
    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getStaffResponse() { return staffResponse; }
    public void setStaffResponse(String staffResponse) { this.staffResponse = staffResponse; }
    public Teacher getReviewedByTeacher() { return reviewedByTeacher; }
    public void setReviewedByTeacher(Teacher reviewedByTeacher) { this.reviewedByTeacher = reviewedByTeacher; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
}
