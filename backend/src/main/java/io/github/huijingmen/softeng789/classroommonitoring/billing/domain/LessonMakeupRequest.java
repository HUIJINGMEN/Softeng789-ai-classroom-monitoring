package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
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
@Table(name = "lesson_makeup_requests")
public class LessonMakeupRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lesson_credit_id", nullable = false)
    private LessonCredit lessonCredit;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "preferred_session_id", nullable = false)
    private ClassroomSession preferredSession;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LessonMakeupRequestStatus status = LessonMakeupRequestStatus.SUBMITTED;

    @Column(length = 500)
    private String studentNote;

    @Column(length = 500)
    private String reviewNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_admin_id")
    private Teacher reviewedByAdmin;

    @Column(nullable = false)
    private Instant submittedAt;

    private Instant reviewedAt;

    @PrePersist
    void prePersist() {
        submittedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public LessonCredit getLessonCredit() { return lessonCredit; }
    public void setLessonCredit(LessonCredit lessonCredit) { this.lessonCredit = lessonCredit; }
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }
    public ClassroomSession getPreferredSession() { return preferredSession; }
    public void setPreferredSession(ClassroomSession preferredSession) { this.preferredSession = preferredSession; }
    public LessonMakeupRequestStatus getStatus() { return status; }
    public void setStatus(LessonMakeupRequestStatus status) { this.status = status; }
    public String getStudentNote() { return studentNote; }
    public void setStudentNote(String studentNote) { this.studentNote = studentNote; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    public Teacher getReviewedByAdmin() { return reviewedByAdmin; }
    public void setReviewedByAdmin(Teacher reviewedByAdmin) { this.reviewedByAdmin = reviewedByAdmin; }
    public Instant getSubmittedAt() { return submittedAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
}
