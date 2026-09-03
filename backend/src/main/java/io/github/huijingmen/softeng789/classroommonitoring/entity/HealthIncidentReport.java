package io.github.huijingmen.softeng789.classroommonitoring.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * The formal health/safety record — always a permanent record once created, no further lifecycle.
 * Reached by either path: confirming an AI-detected {@link HealthAlert} creates one automatically
 * (source AI_DETECTED, healthAlert set), or a teacher creates one directly with no AI involvement
 * at all (source TEACHER_REPORTED, healthAlert null).
 */
@Entity
@Table(name = "health_incident_reports")
public class HealthIncidentReport {
    public enum Source {
        AI_DETECTED,
        TEACHER_REPORTED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "student_id")
    private Student student;

    // Required, even for the AI path where it's derivable from the session — a manual report may
    // have no session at all, but must always be classified to a class for RBAC scoping to work.
    @ManyToOne(optional = false)
    @JoinColumn(name = "course_offering_id")
    private CourseOffering courseOffering;

    @ManyToOne
    @JoinColumn(name = "session_id")
    private ClassroomSession session;

    @ManyToOne(optional = false)
    @JoinColumn(name = "teacher_id")
    private Teacher teacher;

    @Column(nullable = false, length = 30)
    private String source;

    @Column(name = "incident_type", nullable = false, length = 60)
    private String incidentType;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "action_taken", columnDefinition = "TEXT")
    private String actionTaken;

    @Column(name = "teacher_notes", columnDefinition = "TEXT")
    private String teacherNotes;

    @ManyToOne
    @JoinColumn(name = "health_alert_id")
    private HealthAlert healthAlert;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @jakarta.persistence.PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Student getStudent() {
        return student;
    }

    public void setStudent(Student student) {
        this.student = student;
    }

    public CourseOffering getCourseOffering() {
        return courseOffering;
    }

    public void setCourseOffering(CourseOffering courseOffering) {
        this.courseOffering = courseOffering;
    }

    public ClassroomSession getSession() {
        return session;
    }

    public void setSession(ClassroomSession session) {
        this.session = session;
    }

    public Teacher getTeacher() {
        return teacher;
    }

    public void setTeacher(Teacher teacher) {
        this.teacher = teacher;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getIncidentType() {
        return incidentType;
    }

    public void setIncidentType(String incidentType) {
        this.incidentType = incidentType;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(Instant occurredAt) {
        this.occurredAt = occurredAt;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getActionTaken() {
        return actionTaken;
    }

    public void setActionTaken(String actionTaken) {
        this.actionTaken = actionTaken;
    }

    public String getTeacherNotes() {
        return teacherNotes;
    }

    public void setTeacherNotes(String teacherNotes) {
        this.teacherNotes = teacherNotes;
    }

    public HealthAlert getHealthAlert() {
        return healthAlert;
    }

    public void setHealthAlert(HealthAlert healthAlert) {
        this.healthAlert = healthAlert;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
