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
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** A teacher-recorded, student-specific accomplishment. Batch recording creates several of these
 * rows so each student can receive a different score or note while sharing the same project or
 * milestone details. Only CONFIRMED rows are exposed to the student portal and report export. */
@Entity
@Table(name = "accomplishments")
public class Accomplishment {
    public enum Category {
        PROJECT,
        MILESTONE,
        AWARD,
        IMPROVEMENT,
        LEADERSHIP,
        OTHER
    }

    public enum Status {
        DRAFT,
        CONFIRMED,
        REVOKED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_offering_id", nullable = false)
    private CourseOffering courseOffering;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_teacher_id", nullable = false)
    private Teacher createdByTeacher;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "confirmed_by_teacher_id")
    private Teacher confirmedByTeacher;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revoked_by_teacher_id")
    private Teacher revokedByTeacher;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private Category category;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "student_note", columnDefinition = "TEXT")
    private String studentNote;

    @Column(precision = 8, scale = 2)
    private BigDecimal points;

    @Column(name = "achievement_date", nullable = false)
    private LocalDate achievementDate;

    @Column(name = "include_in_report", nullable = false)
    private boolean includeInReport = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.DRAFT;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }
    public CourseOffering getCourseOffering() { return courseOffering; }
    public void setCourseOffering(CourseOffering courseOffering) { this.courseOffering = courseOffering; }
    public Teacher getCreatedByTeacher() { return createdByTeacher; }
    public void setCreatedByTeacher(Teacher createdByTeacher) { this.createdByTeacher = createdByTeacher; }
    public Teacher getConfirmedByTeacher() { return confirmedByTeacher; }
    public void setConfirmedByTeacher(Teacher confirmedByTeacher) { this.confirmedByTeacher = confirmedByTeacher; }
    public Teacher getRevokedByTeacher() { return revokedByTeacher; }
    public void setRevokedByTeacher(Teacher revokedByTeacher) { this.revokedByTeacher = revokedByTeacher; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStudentNote() { return studentNote; }
    public void setStudentNote(String studentNote) { this.studentNote = studentNote; }
    public BigDecimal getPoints() { return points; }
    public void setPoints(BigDecimal points) { this.points = points; }
    public LocalDate getAchievementDate() { return achievementDate; }
    public void setAchievementDate(LocalDate achievementDate) { this.achievementDate = achievementDate; }
    public boolean isIncludeInReport() { return includeInReport; }
    public void setIncludeInReport(boolean includeInReport) { this.includeInReport = includeInReport; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(Instant confirmedAt) { this.confirmedAt = confirmedAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }
}
