package io.github.huijingmen.softeng789.classroommonitoring.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** A frozen, teacher-reviewed synthesis of raw ProgressReport feedback for one student, class and
 * date range. Raw feedback remains the audit source; reports and the student portal use this
 * compact publication record instead of printing every source note. */
@Entity
@Table(name = "feedback_summaries")
public class FeedbackSummary {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "student_id")
    private Student student;

    @ManyToOne(optional = false)
    @JoinColumn(name = "course_offering_id")
    private CourseOffering courseOffering;

    @ManyToOne(optional = false)
    @JoinColumn(name = "created_by_teacher_id")
    private Teacher createdBy;

    @ManyToOne
    @JoinColumn(name = "reviewed_by_teacher_id")
    private Teacher reviewedBy;

    @Column(name = "date_from", nullable = false)
    private LocalDate dateFrom;

    @Column(name = "date_to", nullable = false)
    private LocalDate dateTo;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String summary;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String strengths;

    @Column(name = "next_steps", nullable = false, columnDefinition = "TEXT")
    private String nextSteps;

    @Column(name = "source_feedback_count", nullable = false)
    private int sourceFeedbackCount;

    @Column(name = "source_fingerprint", nullable = false, length = 64)
    private String sourceFingerprint;

    @Column(nullable = false, length = 40)
    private String provider;

    @Column(nullable = false, length = 20)
    private String status = "DRAFT";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "emailed_at")
    private Instant emailedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }
    public CourseOffering getCourseOffering() { return courseOffering; }
    public void setCourseOffering(CourseOffering courseOffering) { this.courseOffering = courseOffering; }
    public Teacher getCreatedBy() { return createdBy; }
    public void setCreatedBy(Teacher createdBy) { this.createdBy = createdBy; }
    public Teacher getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Teacher reviewedBy) { this.reviewedBy = reviewedBy; }
    public LocalDate getDateFrom() { return dateFrom; }
    public void setDateFrom(LocalDate dateFrom) { this.dateFrom = dateFrom; }
    public LocalDate getDateTo() { return dateTo; }
    public void setDateTo(LocalDate dateTo) { this.dateTo = dateTo; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getStrengths() { return strengths; }
    public void setStrengths(String strengths) { this.strengths = strengths; }
    public String getNextSteps() { return nextSteps; }
    public void setNextSteps(String nextSteps) { this.nextSteps = nextSteps; }
    public int getSourceFeedbackCount() { return sourceFeedbackCount; }
    public void setSourceFeedbackCount(int sourceFeedbackCount) { this.sourceFeedbackCount = sourceFeedbackCount; }
    public String getSourceFingerprint() { return sourceFingerprint; }
    public void setSourceFingerprint(String sourceFingerprint) { this.sourceFingerprint = sourceFingerprint; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
    public Instant getEmailedAt() { return emailedAt; }
    public void setEmailedAt(Instant emailedAt) { this.emailedAt = emailedAt; }
}
