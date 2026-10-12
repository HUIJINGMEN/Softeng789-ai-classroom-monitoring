package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.CascadeType;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "student_session_packages")
public class StudentSessionPackage {
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
    @JoinColumn(name = "invoice_id", nullable = false)
    private StudentInvoice invoice;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "entitlement_id", unique = true)
    private StudentLearningEntitlement entitlement;

    @Column(nullable = false)
    private int purchasedSessions;

    @Column(nullable = false)
    private LocalDate serviceFrom;

    @Column(nullable = false)
    private LocalDate serviceTo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AbsenceBillingPolicy absencePolicy = AbsenceBillingPolicy.CONSUME_UNEXCUSED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private SessionPackageStatus status = SessionPackageStatus.PENDING_PAYMENT;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    private Instant pausedAt;

    private Instant cancelledAt;

    @Column(length = 500)
    private String lifecycleNote;

    @Version
    private Long version;

    @OneToMany(mappedBy = "sessionPackage", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<LessonCredit> lessonCredits = new ArrayList<>();

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
    public CourseOffering getCourseOffering() { return courseOffering; }
    public void setCourseOffering(CourseOffering courseOffering) { this.courseOffering = courseOffering; }
    public StudentInvoice getInvoice() { return invoice; }
    public void setInvoice(StudentInvoice invoice) { this.invoice = invoice; }
    public StudentLearningEntitlement getEntitlement() { return entitlement; }
    public void setEntitlement(StudentLearningEntitlement entitlement) { this.entitlement = entitlement; }
    public int getPurchasedSessions() { return purchasedSessions; }
    public void setPurchasedSessions(int purchasedSessions) { this.purchasedSessions = purchasedSessions; }
    public LocalDate getServiceFrom() { return serviceFrom; }
    public void setServiceFrom(LocalDate serviceFrom) { this.serviceFrom = serviceFrom; }
    public LocalDate getServiceTo() { return serviceTo; }
    public void setServiceTo(LocalDate serviceTo) { this.serviceTo = serviceTo; }
    public AbsenceBillingPolicy getAbsencePolicy() { return absencePolicy; }
    public void setAbsencePolicy(AbsenceBillingPolicy absencePolicy) { this.absencePolicy = absencePolicy; }
    public SessionPackageStatus getStatus() { return status; }
    public void setStatus(SessionPackageStatus status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getPausedAt() { return pausedAt; }
    public void setPausedAt(Instant pausedAt) { this.pausedAt = pausedAt; }
    public Instant getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(Instant cancelledAt) { this.cancelledAt = cancelledAt; }
    public String getLifecycleNote() { return lifecycleNote; }
    public void setLifecycleNote(String lifecycleNote) { this.lifecycleNote = lifecycleNote; }
    public Long getVersion() { return version; }
}
