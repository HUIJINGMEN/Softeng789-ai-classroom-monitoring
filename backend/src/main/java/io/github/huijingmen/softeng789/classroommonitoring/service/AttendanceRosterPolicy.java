package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Shared read policy for historical registers and reports; never grants permission to write. */
public final class AttendanceRosterPolicy {
    private static final ZoneId ZONE = ZoneId.of("Pacific/Auckland");

    private AttendanceRosterPolicy() { }

    // Enrolment boundaries use the explicit school-local session date, consistently with reports.
    // Stored marks remain evidence even if enrolment
    // dates or status were subsequently edited. Unmarked PENDING selections create no rows.
    public static boolean appliesOn(CourseEnrollment enrollment, LocalDate date) {
        return overlaps(enrollment, date, date);
    }

    public static boolean overlaps(CourseEnrollment enrollment, LocalDate from, LocalDate to) {
        return enrollment != null && !to.isBefore(from)
                && enrollment.getStatus() != CourseEnrollment.EnrollmentStatus.PENDING
                && (enrollment.getEnrolledAt() == null
                    || !enrollment.getEnrolledAt().atZone(ZONE).toLocalDate().isAfter(to))
                && (enrollment.getWithdrawnAt() == null
                    || !enrollment.getWithdrawnAt().atZone(ZONE).toLocalDate().isBefore(from));
    }

    public static List<Student> roster(ClassroomSession session, Collection<CourseEnrollment> enrollments,
            Collection<AttendanceRecord> records) {
        Map<UUID, Student> students = new LinkedHashMap<>();
        enrollments.stream().filter(row -> session.getCourseOffering() != null
                        && row.getCourseOffering().getId().equals(session.getCourseOffering().getId())
                        && appliesOn(row, session.getDate()))
                .forEach(row -> students.put(row.getStudent().getId(), row.getStudent()));
        records.stream().filter(row -> row.getSession().getId().equals(session.getId()))
                .forEach(row -> students.putIfAbsent(row.getStudent().getId(), row.getStudent()));
        return students.values().stream()
                .sorted(Comparator.comparing(Student::getLastName).thenComparing(Student::getFirstName)
                        .thenComparing(Student::getStudentNumber))
                .toList();
    }
}
