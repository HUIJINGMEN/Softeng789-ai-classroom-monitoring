package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.BehaviourEvent;
import io.github.huijingmen.softeng789.classroommonitoring.entity.BehaviourEvent.ReviewStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.BehaviourEventRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:behaviour-directory-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class BehaviourEventServiceTest {
    @Autowired
    private BehaviourEventService behaviourEventService;

    @Autowired
    private BehaviourEventRepository behaviourEventRepository;

    @Autowired
    private ClassroomSessionRepository classroomSessionRepository;

    @Autowired
    private CourseOfferingRepository courseOfferingRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @BeforeEach
    void cleanDatabase() {
        behaviourEventRepository.deleteAll();
        classroomSessionRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
        teacherRepository.deleteAll();
    }

    @Test
    void eventDirectoryAppliesTeacherScopeAndAllFiltersBeforePaging() {
        Teacher teacherA = teacher("EVENT-A", "event-a@auckland.ac.nz", "Teacher A", "TEACHER");
        Teacher teacherB = teacher("EVENT-B", "event-b@auckland.ac.nz", "Teacher B", "TEACHER");
        ClassroomSession sessionA = session("COMPSCI 335", teacherA, LocalDate.of(2026, 9, 1));
        ClassroomSession sessionB = session("SOFTENG 789", teacherB, LocalDate.of(2026, 9, 8));
        BehaviourEvent pendingA = event(
                sessionA,
                "Leaving the seat area",
                ReviewStatus.PENDING_REVIEW,
                "2026-09-01T01:00:00Z"
        );
        event(sessionA, "Potential peer interaction", ReviewStatus.CONFIRMED, "2026-09-01T02:00:00Z");
        event(sessionB, "Leaving the seat area", ReviewStatus.PENDING_REVIEW, "2026-09-08T01:00:00Z");

        var result = behaviourEventService.listEvents(
                teacherA.getId(),
                0,
                8,
                "PENDING_REVIEW",
                "COMPSCI 335",
                sessionA.getId(),
                "Leaving the seat area",
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2026, 9, 1)
        );

        assertThat(result.totalItems()).isEqualTo(1);
        assertThat(result.items()).extracting("id").containsExactly(pendingA.getId());
    }

    @Test
    void adminDirectoryShowsGlobalEventsWithPendingDecisionsFirst() {
        Teacher admin = teacher("EVENT-ADMIN", "event-admin@auckland.ac.nz", "Admin", "ADMIN");
        Teacher teacherA = teacher("EVENT-C", "event-c@auckland.ac.nz", "Teacher C", "TEACHER");
        ClassroomSession session = session("COMPSCI 730", teacherA, LocalDate.of(2026, 9, 4));
        BehaviourEvent confirmed = event(
                session,
                "Potential peer interaction",
                ReviewStatus.CONFIRMED,
                "2026-09-04T03:00:00Z"
        );
        BehaviourEvent pending = event(
                session,
                "Leaving the seat area",
                ReviewStatus.PENDING_REVIEW,
                "2026-09-04T01:00:00Z"
        );

        var result = behaviourEventService.listEvents(
                admin.getId(), 0, 8, null, null, null, null, null, null);

        assertThat(result.items()).extracting("id").containsExactly(pending.getId(), confirmed.getId());
    }

    private Teacher teacher(String number, String email, String name, String role) {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber(number);
        teacher.setEmail(email);
        teacher.setName(name);
        teacher.setRole(role);
        return teacherRepository.save(teacher);
    }

    private ClassroomSession session(String code, Teacher teacher, LocalDate date) {
        Course course = new Course();
        course.setCode(code);
        course.setName(code);
        course = courseRepository.save(course);

        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode(code + " 2026");
        offering.setAcademicTerm("2026 Teaching Year");
        offering.getTeachers().add(teacher);
        offering = courseOfferingRepository.save(offering);

        ClassroomSession session = new ClassroomSession();
        session.setCourse(code);
        session.setCourseOffering(offering);
        session.setTeacher(teacher);
        session.setRoom("City · 303-G14");
        session.setDate(date);
        session.setStartTime(date.atStartOfDay(java.time.ZoneOffset.UTC).toInstant());
        session.setEndTime(session.getStartTime().plusSeconds(3600));
        session.setStatus(SessionStatus.COMPLETED);
        return classroomSessionRepository.save(session);
    }

    private BehaviourEvent event(
            ClassroomSession session,
            String type,
            ReviewStatus status,
            String timestamp
    ) {
        BehaviourEvent event = new BehaviourEvent();
        event.setSession(session);
        event.setEventType(type);
        event.setConfidence(new BigDecimal("0.870"));
        event.setTimestamp(Instant.parse(timestamp));
        event.setReviewStatus(status);
        return behaviourEventRepository.save(event);
    }
}
