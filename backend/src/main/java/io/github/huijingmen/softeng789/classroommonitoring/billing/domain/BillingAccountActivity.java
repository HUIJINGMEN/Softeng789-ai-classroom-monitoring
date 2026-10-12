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
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "billing_account_activities")
public class BillingAccountActivity {
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
    @JoinColumn(name = "session_package_id")
    private StudentSessionPackage sessionPackage;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AccountActivityType activityType;

    @Column(precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(length = 160)
    private String fromValue;

    @Column(length = 160)
    private String toValue;

    @Column(nullable = false, length = 500)
    private String reason;

    @Column(length = 120)
    private String externalReference;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id", nullable = false)
    private Teacher actor;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }
    public StudentInvoice getInvoice() { return invoice; }
    public void setInvoice(StudentInvoice invoice) { this.invoice = invoice; }
    public StudentSessionPackage getSessionPackage() { return sessionPackage; }
    public void setSessionPackage(StudentSessionPackage sessionPackage) { this.sessionPackage = sessionPackage; }
    public AccountActivityType getActivityType() { return activityType; }
    public void setActivityType(AccountActivityType activityType) { this.activityType = activityType; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getFromValue() { return fromValue; }
    public void setFromValue(String fromValue) { this.fromValue = fromValue; }
    public String getToValue() { return toValue; }
    public void setToValue(String toValue) { this.toValue = toValue; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getExternalReference() { return externalReference; }
    public void setExternalReference(String externalReference) { this.externalReference = externalReference; }
    public Teacher getActor() { return actor; }
    public void setActor(Teacher actor) { this.actor = actor; }
    public Instant getCreatedAt() { return createdAt; }
}
