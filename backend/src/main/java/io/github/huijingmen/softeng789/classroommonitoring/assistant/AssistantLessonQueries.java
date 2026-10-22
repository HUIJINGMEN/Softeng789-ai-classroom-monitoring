package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantText.ZONE;

@Component
class AssistantLessonQueries {
    static final int MAX_LESSONS = 200;
    private static final int MAX_ATTENDANCE_RECORDS = 10000;
    private final EntityManager database;
    private final CourseEnrollmentRepository enrolments;
    AssistantLessonQueries(EntityManager database, CourseEnrollmentRepository enrolments) {
        this.database = database; this.enrolments = enrolments;
    }
    record Lessons(List<ClassroomSession> sessions, List<AttendanceRecord> marks,
                   List<CourseEnrollment> enrolments, boolean truncated) { }

    Lessons find(Plan plan, Student student) {
        List<CourseEnrollment> studentEnrolments = student == null ? List.of()
                : enrolments.findByStudent_IdOrderByCourseOffering_Course_CodeAsc(student.getId());
        var historical = student == null ? List.<AttendanceRecord>of() : database.createQuery(
                "select a from AttendanceRecord a join fetch a.session s join fetch a.student where a.student.id = :student and s.date between :from and :to", AttendanceRecord.class)
                .setParameter("student", student.getId()).setParameter("from", plan.dateFrom()).setParameter("to", plan.dateTo())
                .setMaxResults(MAX_ATTENDANCE_RECORDS + 1).getResultList();
        if (historical.size() > MAX_ATTENDANCE_RECORDS) throw new ResponseStatusException(BAD_REQUEST, "Too many attendance records. Narrow the dates.");
        var courseIds = new HashSet<UUID>();
        studentEnrolments.stream().filter(row -> row.getStatus() != CourseEnrollment.EnrollmentStatus.PENDING)
                .forEach(row -> courseIds.add(row.getCourseOffering().getId()));
        historical.forEach(row -> courseIds.add(row.getSession().getCourseOffering().getId()));
        if (student != null && courseIds.isEmpty()) return new Lessons(List.of(), List.of(), studentEnrolments, false);
        String filter = student == null ? "" : " and co.id in :courses";
        var query = database.createQuery("select s from ClassroomSession s join fetch s.courseOffering co join fetch co.course c left join fetch s.teacher where s.date between :from and :to"
                + filter + " and (:course = '' or lower(concat(c.code, ' ', c.name, ' ', co.academicTerm)) like :pattern escape '!') order by s.date, s.startTime, s.id", ClassroomSession.class)
                .setParameter("from", plan.dateFrom()).setParameter("to", plan.dateTo())
                .setParameter("course", plan.courseQuery()).setParameter("pattern", "%" + AssistantStudentLookup.literal(plan.courseQuery()) + "%");
        if (student != null) query.setParameter("courses", courseIds);
        var candidates = query.setMaxResults(MAX_LESSONS + 1).getResultList();
        var marked = historical.stream().map(row -> row.getSession().getId()).collect(Collectors.toSet());
        var sessions = candidates.stream().limit(MAX_LESSONS).filter(lesson -> student == null || marked.contains(lesson.getId())
                || studentEnrolments.stream().anyMatch(enrolment -> applies(enrolment, lesson))).toList();
        if (sessions.isEmpty()) return new Lessons(sessions, List.of(), studentEnrolments, candidates.size() > MAX_LESSONS);
        var sessionIds = sessions.stream().map(ClassroomSession::getId).toList();
        var marks = database.createQuery("select a from AttendanceRecord a join fetch a.student where a.session.id in :sessions order by a.session.id, a.student.id", AttendanceRecord.class)
                .setParameter("sessions", sessionIds).setMaxResults(MAX_ATTENDANCE_RECORDS + 1).getResultList();
        if (marks.size() > MAX_ATTENDANCE_RECORDS) throw new ResponseStatusException(BAD_REQUEST, "Too many attendance records. Narrow the course or dates.");
        var entries = student == null ? enrolments.findByCourseOffering_IdInAndStatusInOrderByStudent_LastNameAscStudent_FirstNameAsc(
                sessions.stream().map(row -> row.getCourseOffering().getId()).distinct().toList(),
                List.of(CourseEnrollment.EnrollmentStatus.ACTIVE, CourseEnrollment.EnrollmentStatus.WITHDRAWN)) : studentEnrolments;
        return new Lessons(sessions, marks, entries, candidates.size() > MAX_LESSONS);
    }
    static boolean applies(CourseEnrollment enrolment, ClassroomSession lesson) {
        return enrolment.getStatus() != CourseEnrollment.EnrollmentStatus.PENDING
                && enrolment.getCourseOffering().getId().equals(lesson.getCourseOffering().getId())
                && !lesson.getDate().isBefore(enrolment.getEnrolledAt().atZone(ZONE).toLocalDate())
                && (enrolment.getWithdrawnAt() == null || !lesson.getDate().isAfter(enrolment.getWithdrawnAt().atZone(ZONE).toLocalDate()));
    }
    static boolean started(ClassroomSession session) {
        return session.getStatus() != ClassroomSession.SessionStatus.CANCELLED && !session.getStartTime().isAfter(Instant.now());
    }
}
