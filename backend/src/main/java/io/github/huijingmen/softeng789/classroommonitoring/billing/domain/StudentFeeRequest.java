package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

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
@Table(name = "student_fee_requests")
public class StudentFeeRequest {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "student_id", nullable = false)
    private Student student;
    @Column(nullable = false, length = 160)
    private String title;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String requestDetails;
    @Column(length = 255)
    private String evidenceFileName;
    @Column(length = 100)
    private String evidenceContentType;
    private Long evidenceFileSize;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private FeeRequestStatus status = FeeRequestStatus.SUBMITTED;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "reviewed_by_admin_id")
    private Teacher reviewedByAdmin;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "invoice_id")
    private StudentInvoice invoice;
    @Column(columnDefinition = "TEXT")
    private String reviewNote;
    @Column(nullable = false)
    private Instant submittedAt;
    private Instant reviewedAt;

    @PrePersist void prePersist() { submittedAt = Instant.now(); }
    public UUID getId() { return id; }
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getRequestDetails() { return requestDetails; }
    public void setRequestDetails(String requestDetails) { this.requestDetails = requestDetails; }
    public String getEvidenceFileName() { return evidenceFileName; }
    public void setEvidenceFileName(String evidenceFileName) { this.evidenceFileName = evidenceFileName; }
    public String getEvidenceContentType() { return evidenceContentType; }
    public void setEvidenceContentType(String evidenceContentType) { this.evidenceContentType = evidenceContentType; }
    public Long getEvidenceFileSize() { return evidenceFileSize; }
    public void setEvidenceFileSize(Long evidenceFileSize) { this.evidenceFileSize = evidenceFileSize; }
    public FeeRequestStatus getStatus() { return status; }
    public void setStatus(FeeRequestStatus status) { this.status = status; }
    public Teacher getReviewedByAdmin() { return reviewedByAdmin; }
    public void setReviewedByAdmin(Teacher reviewedByAdmin) { this.reviewedByAdmin = reviewedByAdmin; }
    public StudentInvoice getInvoice() { return invoice; }
    public void setInvoice(StudentInvoice invoice) { this.invoice = invoice; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    public Instant getSubmittedAt() { return submittedAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
}
