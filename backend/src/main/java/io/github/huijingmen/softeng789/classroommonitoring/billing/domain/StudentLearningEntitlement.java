package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * The durable answer to "what learning access did this student buy?". An invoice can finance an
 * entitlement, but attendance and financial transactions remain separate records.
 */
@Entity
@Table(name = "student_learning_entitlements")
public class StudentLearningEntitlement {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id")
    private StudentInvoice invoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "line_item_id")
    private InvoiceLineItem lineItem;

    @Column(nullable = false)
    private int position;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_offering_id", nullable = false)
    private CourseOffering courseOffering;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classroom_session_id")
    private ClassroomSession classroomSession;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private CoursePurchaseMode purchaseMode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private LearningEntitlementStatus status = LearningEntitlementStatus.PENDING_PAYMENT;

    private LocalDate validFrom;

    private LocalDate validTo;

    /** Null means attendance is not consumed from a finite balance. */
    private Integer sessionAllowance;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

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
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }
    public StudentInvoice getInvoice() { return invoice; }
    public void setInvoice(StudentInvoice invoice) { this.invoice = invoice; }
    public InvoiceLineItem getLineItem() { return lineItem; }
    public void setLineItem(InvoiceLineItem lineItem) { this.lineItem = lineItem; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public CourseOffering getCourseOffering() { return courseOffering; }
    public void setCourseOffering(CourseOffering courseOffering) { this.courseOffering = courseOffering; }
    public ClassroomSession getClassroomSession() { return classroomSession; }
    public void setClassroomSession(ClassroomSession classroomSession) { this.classroomSession = classroomSession; }
    public CoursePurchaseMode getPurchaseMode() { return purchaseMode; }
    public void setPurchaseMode(CoursePurchaseMode purchaseMode) { this.purchaseMode = purchaseMode; }
    public LearningEntitlementStatus getStatus() { return status; }
    public void setStatus(LearningEntitlementStatus status) { this.status = status; }
    public LocalDate getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDate validFrom) { this.validFrom = validFrom; }
    public LocalDate getValidTo() { return validTo; }
    public void setValidTo(LocalDate validTo) { this.validTo = validTo; }
    public Integer getSessionAllowance() { return sessionAllowance; }
    public void setSessionAllowance(Integer sessionAllowance) { this.sessionAllowance = sessionAllowance; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
