package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
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

@Entity
@Table(name = "lesson_credit_events")
public class LessonCreditEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lesson_credit_id", nullable = false)
    private LessonCredit lessonCredit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private LessonCreditEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private LessonCreditStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private LessonCreditStatus toStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_session_id")
    private ClassroomSession sourceSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_session_id")
    private ClassroomSession targetSession;

    @Column(length = 500)
    private String note;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private Teacher actor;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public LessonCredit getLessonCredit() { return lessonCredit; }
    public void setLessonCredit(LessonCredit lessonCredit) { this.lessonCredit = lessonCredit; }
    public LessonCreditEventType getEventType() { return eventType; }
    public void setEventType(LessonCreditEventType eventType) { this.eventType = eventType; }
    public LessonCreditStatus getFromStatus() { return fromStatus; }
    public void setFromStatus(LessonCreditStatus fromStatus) { this.fromStatus = fromStatus; }
    public LessonCreditStatus getToStatus() { return toStatus; }
    public void setToStatus(LessonCreditStatus toStatus) { this.toStatus = toStatus; }
    public ClassroomSession getSourceSession() { return sourceSession; }
    public void setSourceSession(ClassroomSession sourceSession) { this.sourceSession = sourceSession; }
    public ClassroomSession getTargetSession() { return targetSession; }
    public void setTargetSession(ClassroomSession targetSession) { this.targetSession = targetSession; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public Teacher getActor() { return actor; }
    public void setActor(Teacher actor) { this.actor = actor; }
    public Instant getCreatedAt() { return createdAt; }
}
