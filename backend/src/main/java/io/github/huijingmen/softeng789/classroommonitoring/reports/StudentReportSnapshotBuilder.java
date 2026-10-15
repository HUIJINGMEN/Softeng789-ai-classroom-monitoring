package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

/** Server-owned, frozen facts for charts and identity; never derived from model-generated prose. */
@Component
public class StudentReportSnapshotBuilder {
    private static final ZoneId ZONE = ZoneId.of("Pacific/Auckland");
    private final StudentRepository students;
    private final CourseEnrollmentRepository enrolments;
    private final ClassroomSessionRepository sessions;
    private final BehaviourEventRepository events;

    public StudentReportSnapshotBuilder(StudentRepository students, CourseEnrollmentRepository enrolments,
            ClassroomSessionRepository sessions, BehaviourEventRepository events) {
        this.students = students; this.enrolments = enrolments; this.sessions = sessions; this.events = events;
    }

    Snapshot build(Scope scope, List<AttendanceRecord> records, List<ProgressReport> notes,
            ReportAchievementEligibility.Selection awards, PaymentSnapshot payments, Instant asOf) {
        var student = students.findById(scope.studentId()).orElseThrow();
        Map<UUID, ClassroomSession> expected = new LinkedHashMap<>();
        List<CourseSummary> courses = new ArrayList<>();
        for (UUID courseId : scope.courseOfferingIds()) {
            var enrolment = enrolments.findByStudent_IdAndCourseOffering_Id(scope.studentId(), courseId).orElseThrow();
            var course = enrolment.getCourseOffering();
            var joined = enrolment.getEnrolledAt().atZone(ZONE).toLocalDate();
            var withdrew = enrolment.getWithdrawnAt() == null ? null : enrolment.getWithdrawnAt().atZone(ZONE).toLocalDate();
            List<ClassroomSession> lessons = enrolment.getStatus() == CourseEnrollment.EnrollmentStatus.PENDING ? List.of()
                    : sessions.findByCourseOffering_IdAndDateBetweenAndStatusOrderByDateAscStartTimeAsc(
                        courseId, scope.dateFrom(), scope.dateTo(), ClassroomSession.SessionStatus.COMPLETED).stream()
                        .filter(row -> ReportSessionTime.completedBy(row, asOf))
                        .filter(row -> !row.getDate().isBefore(joined))
                        .filter(row -> withdrew == null || !row.getDate().isAfter(withdrew)).toList();
            lessons.forEach(row -> expected.put(row.getId(), row));
            // A real completed attendance mark remains historical evidence after enrolment changes.
            records.stream().filter(row -> row.getSession().getCourseOffering().getId().equals(courseId))
                    .filter(row -> ReportSessionTime.completedBy(row.getSession(), asOf))
                    .forEach(row -> expected.put(row.getSession().getId(), row.getSession()));
            var courseLessons = expected.values().stream().filter(row -> row.getCourseOffering().getId().equals(courseId)).toList();
            courses.add(new CourseSummary(courseId, course.getCourse().getCode(), course.getCourse().getName(),
                    course.getAcademicTerm(), course.getTeachers().stream().map(Teacher::getName).sorted().toList(),
                    enrolment.getStatus().name(), summary(courseLessons, records)));
        }
        var weeks = expected.values().stream().collect(Collectors.groupingBy(
                row -> row.getDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)), TreeMap::new, Collectors.toList()));
        var trend = weeks.entrySet().stream().map(entry -> new AttendancePoint(entry.getKey(), summary(entry.getValue(), records))).toList();
        List<BehaviourEvent> confirmed = expected.isEmpty() ? List.of()
                : events.findByStudent_IdAndSession_IdIn(scope.studentId(), expected.keySet()).stream()
                    .filter(row -> row.getReviewStatus() == BehaviourEvent.ReviewStatus.CONFIRMED
                            || row.getReviewStatus() == BehaviourEvent.ReviewStatus.CORRECTED).toList();
        var counts = confirmed.stream().collect(Collectors.groupingBy(BehaviourEvent::getEventType, TreeMap::new, Collectors.counting()));
        return new Snapshot(new StudentInfo(student.getFullName(), student.getStudentNumber(), student.getUniversityEmail(), student.getProgramme(),
                student.getLevel().name()), List.copyOf(courses), summary(new ArrayList<>(expected.values()), records), trend,
                counts.entrySet().stream().map(entry -> new EventCount(entry.getKey(), entry.getValue())).toList(), notes.size(), payments, asOf,
                new ReportSourceModels.StudentSources(lessonRecords(expected, records), ReportSourceEvidence.personalFeedback(notes),
                        ReportSourceEvidence.achievements(awards.included()), awards.pending().size()));
    }

    private List<ReportSourceModels.Lesson> lessonRecords(Map<UUID, ClassroomSession> expected, List<AttendanceRecord> records) {
        var statuses = records.stream().collect(Collectors.toMap(row -> row.getSession().getId(), row -> row.getStatus().name()));
        return expected.values().stream().sorted(Comparator.comparing(ClassroomSession::getDate)
                .thenComparing(ClassroomSession::getStartTime).thenComparing(ClassroomSession::getId))
                .map(row -> new ReportSourceModels.Lesson(row.getId(), row.getCourseOffering().getId(),
                        ReportSourceEvidence.label(row.getCourseOffering()), row.getDate(), row.getStartTime(),
                        statuses.getOrDefault(row.getId(), "UNKNOWN"))).toList();
    }

    private AttendanceSummary summary(List<ClassroomSession> lessons, List<AttendanceRecord> records) {
        Set<UUID> ids = lessons.stream().map(ClassroomSession::getId).collect(Collectors.toSet());
        var marks = records.stream().filter(row -> ids.contains(row.getSession().getId())).toList();
        long present = count(marks, AttendanceRecord.AttendanceStatus.PRESENT);
        long late = count(marks, AttendanceRecord.AttendanceStatus.LATE);
        long absent = count(marks, AttendanceRecord.AttendanceStatus.ABSENT);
        long recorded = present + late + absent;
        return new AttendanceSummary(ids.size(), present, late, absent, ids.size() - recorded,
                recorded == 0 ? null : (int) Math.round(100.0 * (present + late) / recorded));
    }
    private long count(List<AttendanceRecord> rows, AttendanceRecord.AttendanceStatus status) {
        return rows.stream().filter(row -> row.getStatus() == status).count();
    }
}
