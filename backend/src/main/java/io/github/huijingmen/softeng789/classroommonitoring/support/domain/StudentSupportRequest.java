package io.github.huijingmen.softeng789.classroommonitoring.support.domain;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
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
@Table(name = "student_support_requests")
public class StudentSupportRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Enumerated(EnumType.STRING)
    @Column(name = "requester_role", nullable = false, length = 24)
    private StudentRequesterRole requesterRole;

    @Column(name = "contact_name", nullable = false, length = 160)
    private String contactName;

    @Column(name = "relationship_to_student", length = 80)
    private String relationshipToStudent;

    @Column(name = "contact_email", nullable = false, length = 255)
    private String contactEmail;

    @Column(name = "contact_phone", length = 40)
    private String contactPhone;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false, length = 32)
    private StudentRequestType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudentRequestStatus status = StudentRequestStatus.SUBMITTED;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_offering_id")
    private CourseOffering courseOffering;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private ClassroomSession session;

    @Enumerated(EnumType.STRING)
    @Column(name = "leave_reason", length = 32)
    private LeaveReason leaveReason;

    @Enumerated(EnumType.STRING)
    @Column(name = "leave_lesson_treatment", length = 32)
    private LeaveLessonTreatment leaveLessonTreatment;

    @Column(nullable = false, length = 160)
    private String subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "review_note", columnDefinition = "TEXT")
    private String reviewNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_admin_id")
    private Teacher reviewedByAdmin;

    @Column(nullable = false)
    private Instant submittedAt;

    private Instant reviewedAt;

    private Instant cancelledAt;

    @PrePersist
    void prePersist() {
        if (submittedAt == null) submittedAt = Instant.now();
        if (status == null) status = StudentRequestStatus.SUBMITTED;
    }

    public UUID getId() { return id; }
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }
    public StudentRequesterRole getRequesterRole() { return requesterRole; }
    public void setRequesterRole(StudentRequesterRole requesterRole) { this.requesterRole = requesterRole; }
    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }
    public String getRelationshipToStudent() { return relationshipToStudent; }
    public void setRelationshipToStudent(String relationshipToStudent) { this.relationshipToStudent = relationshipToStudent; }
    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }
    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
    public StudentRequestType getType() { return type; }
    public void setType(StudentRequestType type) { this.type = type; }
    public StudentRequestStatus getStatus() { return status; }
    public void setStatus(StudentRequestStatus status) { this.status = status; }
    public CourseOffering getCourseOffering() { return courseOffering; }
    public void setCourseOffering(CourseOffering courseOffering) { this.courseOffering = courseOffering; }
    public ClassroomSession getSession() { return session; }
    public void setSession(ClassroomSession session) { this.session = session; }
    public LeaveReason getLeaveReason() { return leaveReason; }
    public void setLeaveReason(LeaveReason leaveReason) { this.leaveReason = leaveReason; }
    public LeaveLessonTreatment getLeaveLessonTreatment() { return leaveLessonTreatment; }
    public void setLeaveLessonTreatment(LeaveLessonTreatment leaveLessonTreatment) { this.leaveLessonTreatment = leaveLessonTreatment; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    public Teacher getReviewedByAdmin() { return reviewedByAdmin; }
    public void setReviewedByAdmin(Teacher reviewedByAdmin) { this.reviewedByAdmin = reviewedByAdmin; }
    public Instant getSubmittedAt() { return submittedAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
    public Instant getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(Instant cancelledAt) { this.cancelledAt = cancelledAt; }
}
