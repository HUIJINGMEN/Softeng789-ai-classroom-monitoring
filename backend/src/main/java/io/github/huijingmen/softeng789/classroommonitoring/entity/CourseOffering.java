package io.github.huijingmen.softeng789.classroommonitoring.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "course_offerings")
public class CourseOffering {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(nullable = false, unique = true, length = 160)
    private String offeringCode;

    @Column(nullable = false, length = 80)
    private String academicTerm;

    // "ACTIVE" or "ARCHIVED" — plain string to match Teacher.role's style.
    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    // A class can be taught by more than one teacher, so this is a many-to-many rather than the
    // single teacher_id column it used to be.
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "course_offering_teachers",
            joinColumns = @JoinColumn(name = "course_offering_id"),
            inverseJoinColumns = @JoinColumn(name = "teacher_id"))
    private Set<Teacher> teachers = new HashSet<>();

    public UUID getId() {
        return id;
    }

    public Course getCourse() {
        return course;
    }

    public void setCourse(Course course) {
        this.course = course;
    }

    public String getOfferingCode() {
        return offeringCode;
    }

    public void setOfferingCode(String offeringCode) {
        this.offeringCode = offeringCode;
    }

    public String getAcademicTerm() {
        return academicTerm;
    }

    public void setAcademicTerm(String academicTerm) {
        this.academicTerm = academicTerm;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Set<Teacher> getTeachers() {
        return teachers;
    }

    // The single source of truth for "does this teacher teach this class" — every access-control
    // check that needs this answer (session scheduling, health alerts/reports) should call this
    // rather than reimplementing .getTeachers().contains(...) itself.
    public boolean isTaughtBy(Teacher teacher) {
        return teacher != null && teachers.contains(teacher);
    }
}
