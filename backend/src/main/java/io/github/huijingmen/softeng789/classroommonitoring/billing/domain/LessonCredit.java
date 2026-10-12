package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AbsenceReason;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.CascadeType;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "lesson_credits",
        uniqueConstraints = @UniqueConstraint(columnNames = {"session_package_id", "sequence_number"})
)
public class LessonCredit {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_package_id", nullable = false)
    private StudentSessionPackage sessionPackage;

    @Column(nullable = false)
    private int sequenceNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_session_id")
    private ClassroomSession originalSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_session_id")
    private ClassroomSession currentSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_attendance_record_id")
    private AttendanceRecord sourceAttendanceRecord;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private LessonCreditStatus status = LessonCreditStatus.AVAILABLE;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private AbsenceReason absenceReason;

    @Column(length = 500)
    private String decisionNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by_admin_id")
    private Teacher decidedByAdmin;

    @Column(nullable = false)
    private LocalDate expiresOn;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Version
    private Long version;

    @OneToMany(mappedBy = "lessonCredit", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<LessonCreditEvent> events = new ArrayList<>();

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public StudentSessionPackage getSessionPackage() { return sessionPackage; }
    public void setSessionPackage(StudentSessionPackage sessionPackage) { this.sessionPackage = sessionPackage; }
    public int getSequenceNumber() { return sequenceNumber; }
    public void setSequenceNumber(int sequenceNumber) { this.sequenceNumber = sequenceNumber; }
    public ClassroomSession getOriginalSession() { return originalSession; }
    public void setOriginalSession(ClassroomSession originalSession) { this.originalSession = originalSession; }
    public ClassroomSession getCurrentSession() { return currentSession; }
    public void setCurrentSession(ClassroomSession currentSession) { this.currentSession = currentSession; }
    public AttendanceRecord getSourceAttendanceRecord() { return sourceAttendanceRecord; }
    public void setSourceAttendanceRecord(AttendanceRecord sourceAttendanceRecord) { this.sourceAttendanceRecord = sourceAttendanceRecord; }
    public LessonCreditStatus getStatus() { return status; }
    public void setStatus(LessonCreditStatus status) { this.status = status; }
    public AbsenceReason getAbsenceReason() { return absenceReason; }
    public void setAbsenceReason(AbsenceReason absenceReason) { this.absenceReason = absenceReason; }
    public String getDecisionNote() { return decisionNote; }
    public void setDecisionNote(String decisionNote) { this.decisionNote = decisionNote; }
    public Teacher getDecidedByAdmin() { return decidedByAdmin; }
    public void setDecidedByAdmin(Teacher decidedByAdmin) { this.decidedByAdmin = decidedByAdmin; }
    public LocalDate getExpiresOn() { return expiresOn; }
    public void setExpiresOn(LocalDate expiresOn) { this.expiresOn = expiresOn; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
