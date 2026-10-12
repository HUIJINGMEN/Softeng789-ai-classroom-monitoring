package io.github.huijingmen.softeng789.classroommonitoring.billing.domain;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
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
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "attendance_billing_overrides")
public class AttendanceBillingOverride {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attendance_record_id", nullable = false, unique = true)
    private AttendanceRecord attendanceRecord;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AttendanceBillingDecision decision;

    @Column(nullable = false, length = 500)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "updated_by_admin_id", nullable = false)
    private Teacher updatedByAdmin;

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
    public AttendanceRecord getAttendanceRecord() { return attendanceRecord; }
    public void setAttendanceRecord(AttendanceRecord attendanceRecord) { this.attendanceRecord = attendanceRecord; }
    public AttendanceBillingDecision getDecision() { return decision; }
    public void setDecision(AttendanceBillingDecision decision) { this.decision = decision; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Teacher getUpdatedByAdmin() { return updatedByAdmin; }
    public void setUpdatedByAdmin(Teacher updatedByAdmin) { this.updatedByAdmin = updatedByAdmin; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
