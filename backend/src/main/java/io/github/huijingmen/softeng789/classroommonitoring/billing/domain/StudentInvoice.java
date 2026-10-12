package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.BatchSize;

@Entity
@Table(name = "student_invoices")
public class StudentInvoice {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_admin_id", nullable = false)
    private Teacher createdByAdmin;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL)
    @OrderBy("position ASC, id ASC")
    @BatchSize(size = 50)
    private List<StudentLearningEntitlement> entitlements = new ArrayList<>();

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false, unique = true, length = 32)
    private String invoiceNumber;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(nullable = false)
    private LocalDate dueDate;

    @Column(nullable = false, length = 3)
    private String currency = "NZD";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private InvoiceStatus status = InvoiceStatus.DRAFT;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC, id ASC")
    @BatchSize(size = 50)
    private List<InvoiceLineItem> lineItems = new ArrayList<>();

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("occurredAt DESC, id DESC")
    @BatchSize(size = 50)
    private List<PaymentTransaction> transactions = new ArrayList<>();

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    private Instant lastEmailedAt;

    private Instant messageReviewedAt;

    private Instant messageDraftSavedAt;

    @Column(length = 100)
    private String lastDeliveryKey;

    @Column(length = 16)
    private String lastDeliveryStatus;

    @Version
    private Long version;

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

    public void addLineItem(InvoiceLineItem item) {
        item.setInvoice(this);
        lineItems.add(item);
    }

    public void addTransaction(PaymentTransaction transaction) {
        transaction.setInvoice(this);
        transactions.add(transaction);
    }

    public UUID getId() { return id; }
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }
    public Teacher getCreatedByAdmin() { return createdByAdmin; }
    public void setCreatedByAdmin(Teacher createdByAdmin) { this.createdByAdmin = createdByAdmin; }
    /** Compatibility accessor for older single-course callers. */
    public StudentLearningEntitlement getEntitlement() {
        return entitlements.isEmpty() ? null : entitlements.getFirst();
    }
    public List<StudentLearningEntitlement> getEntitlements() { return entitlements; }
    public void addEntitlement(StudentLearningEntitlement entitlement) {
        entitlement.setInvoice(this);
        entitlement.setPosition(entitlements.size());
        entitlements.add(entitlement);
    }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public InvoiceStatus getStatus() { return status; }
    public void setStatus(InvoiceStatus status) { this.status = status; }
    public List<InvoiceLineItem> getLineItems() { return lineItems; }
    public List<PaymentTransaction> getTransactions() { return transactions; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getLastEmailedAt() { return lastEmailedAt; }
    public void setLastEmailedAt(Instant lastEmailedAt) { this.lastEmailedAt = lastEmailedAt; }
    public Instant getMessageReviewedAt() { return messageReviewedAt; }
    public void setMessageReviewedAt(Instant messageReviewedAt) { this.messageReviewedAt = messageReviewedAt; }
    public Instant getMessageDraftSavedAt() { return messageDraftSavedAt; }
    public void setMessageDraftSavedAt(Instant messageDraftSavedAt) { this.messageDraftSavedAt = messageDraftSavedAt; }
    public String getLastDeliveryKey() { return lastDeliveryKey; }
    public void setLastDeliveryKey(String lastDeliveryKey) { this.lastDeliveryKey = lastDeliveryKey; }
    public String getLastDeliveryStatus() { return lastDeliveryStatus; }
    public void setLastDeliveryStatus(String lastDeliveryStatus) { this.lastDeliveryStatus = lastDeliveryStatus; }
}
