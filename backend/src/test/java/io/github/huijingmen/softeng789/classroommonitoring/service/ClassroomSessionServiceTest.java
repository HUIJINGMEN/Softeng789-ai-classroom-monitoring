package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassroomSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateClassroomSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Campus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CampusRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.RoomRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:session-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class ClassroomSessionServiceTest {
    @Autowired
    private ClassroomSessionService classroomSessionService;

    @Autowired
    private ClassroomSessionRepository classroomSessionRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private CourseOfferingRepository courseOfferingRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private CampusRepository campusRepository;

    @BeforeEach
    void cleanDatabase() {
        attendanceRecordRepository.deleteAll();
        classroomSessionRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
        teacherRepository.deleteAll();
        roomRepository.deleteAll();
        campusRepository.deleteAll();
    }

    @Test
    void scheduledSessionCanStartAndEnd() {
        // Sessions can only reference a teacher already assigned to the class — creating a session
        // no longer silently mints a claimable teacher record for an arbitrary email.
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-DKESSLER");
        teacher.setEmail("d.kessler@auckland.ac.nz");
        teacher.setName("Dr. Dana Kessler");
        teacherRepository.save(teacher);

        CourseOffering offering = activeOffering("SOFTENG 789", teacher);

        var created = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(),
                roomId("Room 405-460"),
                "d.kessler@auckland.ac.nz",
                "UOA-DKESSLER",
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"),
                Instant.parse("2026-08-13T11:00:00Z"),
                null
        ));

        assertThat(created.status()).isEqualTo(SessionStatus.SCHEDULED);
        assertThat(created.course()).isEqualTo("SOFTENG 789");
        assertThat(created.courseOfferingId()).isEqualTo(offering.getId());
        assertThat(created.roomId()).isNotNull();
        assertThat(created.teacherId()).isNotNull();
        assertThat(created.teacherName()).isEqualTo("Dr. Dana Kessler");

        var started = classroomSessionService.startSession(created.id());
        assertThat(started.status()).isEqualTo(SessionStatus.ACTIVE);

        var completed = classroomSessionService.endSession(created.id());
        assertThat(completed.status()).isEqualTo(SessionStatus.COMPLETED);

        assertThat(classroomSessionRepository.findById(created.id()))
                .get()
                .extracting("status")
                .isEqualTo(SessionStatus.COMPLETED);
    }

    @Test
    void scheduledOrLiveSessionCanBeCancelledButNotAfterItEnds() {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-DKESSLER");
        teacher.setEmail("d.kessler@auckland.ac.nz");
        teacher.setName("Dr. Dana Kessler");
        teacherRepository.save(teacher);
        CourseOffering offering = activeOffering("SOFTENG 789", teacher);

        var scheduled = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(), roomId("Room 405-460"), "d.kessler@auckland.ac.nz", null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"), Instant.parse("2026-08-13T11:00:00Z"), null
        ));
        var cancelled = classroomSessionService.cancelSession(scheduled.id());
        assertThat(cancelled.status()).isEqualTo(SessionStatus.CANCELLED);

        var live = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(), roomId("Room 405-460"), "d.kessler@auckland.ac.nz", null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T12:00:00Z"), Instant.parse("2026-08-13T13:00:00Z"), null
        ));
        classroomSessionService.startSession(live.id());
        assertThat(classroomSessionService.cancelSession(live.id()).status()).isEqualTo(SessionStatus.CANCELLED);

        var completed = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(), roomId("Room 405-460"), "d.kessler@auckland.ac.nz", null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T14:00:00Z"), Instant.parse("2026-08-13T15:00:00Z"), null
        ));
        classroomSessionService.startSession(completed.id());
        classroomSessionService.endSession(completed.id());
        assertThatThrownBy(() -> classroomSessionService.cancelSession(completed.id()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already ended");

        assertThatThrownBy(() -> classroomSessionService.cancelSession(scheduled.id()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already been cancelled");
    }

    @Test
    void completedOrCancelledSessionCanNoLongerBeEditedOrStartedOrEnded() {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-DKESSLER");
        teacher.setEmail("d.kessler@auckland.ac.nz");
        teacher.setName("Dr. Dana Kessler");
        teacherRepository.save(teacher);
        CourseOffering offering = activeOffering("SOFTENG 789", teacher);

        var completed = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(), roomId("Room 405-460"), "d.kessler@auckland.ac.nz", null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"), Instant.parse("2026-08-13T11:00:00Z"), null
        ));
        classroomSessionService.startSession(completed.id());
        classroomSessionService.endSession(completed.id());

        UpdateClassroomSessionRequest updateRequest = new UpdateClassroomSessionRequest(
                offering.getId(), roomId("Room 999-999"), "d.kessler@auckland.ac.nz", null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"), Instant.parse("2026-08-13T11:00:00Z"),
                SessionStatus.COMPLETED
        );

        assertThatThrownBy(() -> classroomSessionService.updateSession(completed.id(), updateRequest))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already ended");
        assertThatThrownBy(() -> classroomSessionService.startSession(completed.id()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already ended");
        assertThatThrownBy(() -> classroomSessionService.endSession(completed.id()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already ended");

        // Unaffected: still exactly COMPLETED with its original room, not silently changed.
        assertThat(classroomSessionRepository.findById(completed.id()))
                .get()
                .extracting("status", "room")
                .containsExactly(SessionStatus.COMPLETED, "Room 405-460");
    }

    @Test
    void scheduledSessionCanBeEdited() {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-DKESSLER");
        teacher.setEmail("d.kessler@auckland.ac.nz");
        teacher.setName("Dr. Dana Kessler");
        teacherRepository.save(teacher);
        CourseOffering offering = activeOffering("SOFTENG 789", teacher);

        var scheduled = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(), roomId("Room 405-460"), "d.kessler@auckland.ac.nz", null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"), Instant.parse("2026-08-13T11:00:00Z"), null
        ));

        var updated = classroomSessionService.updateSession(scheduled.id(), new UpdateClassroomSessionRequest(
                offering.getId(), roomId("Room 260-092"), "d.kessler@auckland.ac.nz", null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"), Instant.parse("2026-08-13T11:00:00Z"),
                SessionStatus.SCHEDULED
        ));

        assertThat(updated.room()).isEqualTo("Room 260-092");
    }

    @Test
    void schedulingWithAnUnregisteredTeacherEmailIsRejected() {
        Teacher classTeacher = new Teacher();
        classTeacher.setStaffNumber("UOA-DKESSLER");
        classTeacher.setEmail("d.kessler@auckland.ac.nz");
        classTeacher.setName("Dr. Dana Kessler");
        teacherRepository.save(classTeacher);
        CourseOffering offering = activeOffering("SOFTENG 789", classTeacher);

        assertThatThrownBy(() -> classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(),
                roomId("Room 405-460"),
                "not-a-real-teacher@auckland.ac.nz",
                null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"),
                Instant.parse("2026-08-13T11:00:00Z"),
                null
        )))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("No teacher is registered");

        assertThat(teacherRepository.findByEmailIgnoreCase("not-a-real-teacher@auckland.ac.nz")).isEmpty();
    }

    @Test
    void schedulingAgainstAClassWithNoAssignedTeacherIsRejected() {
        CourseOffering offering = activeOffering("SOFTENG 789", null);

        assertThatThrownBy(() -> classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(),
                roomId("Room 405-460"),
                null,
                null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"),
                Instant.parse("2026-08-13T11:00:00Z"),
                null
        )))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("This class has no assigned teacher");
    }

    @Test
    void schedulingWithATeacherNotAssignedToTheClassIsRejected() {
        Teacher classTeacher = new Teacher();
        classTeacher.setStaffNumber("UOA-DKESSLER");
        classTeacher.setEmail("d.kessler@auckland.ac.nz");
        classTeacher.setName("Dr. Dana Kessler");
        teacherRepository.save(classTeacher);

        Teacher outsider = new Teacher();
        outsider.setStaffNumber("UOA-OUTSIDER");
        outsider.setEmail("outsider@auckland.ac.nz");
        outsider.setName("Prof Outsider");
        teacherRepository.save(outsider);

        CourseOffering offering = activeOffering("SOFTENG 789", classTeacher);

        assertThatThrownBy(() -> classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(),
                roomId("Room 405-460"),
                "outsider@auckland.ac.nz",
                null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"),
                Instant.parse("2026-08-13T11:00:00Z"),
                null
        )))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not assigned to this class");
    }

    @Test
    void schedulingWithADeactivatedTeacherIsRejected() {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-DKESSLER");
        teacher.setEmail("d.kessler@auckland.ac.nz");
        teacher.setName("Dr. Dana Kessler");
        teacher.setStatus("DEACTIVATED");
        teacherRepository.save(teacher);
        CourseOffering offering = activeOffering("SOFTENG 789", teacher);

        assertThatThrownBy(() -> classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(),
                roomId("Room 405-460"),
                "d.kessler@auckland.ac.nz",
                null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"),
                Instant.parse("2026-08-13T11:00:00Z"),
                null
        )))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("deactivated");
    }

    @Test
    void schedulingAgainstAClassThatDoesNotExistIsRejected() {
        assertThatThrownBy(() -> classroomSessionService.createSession(new CreateClassroomSessionRequest(
                UUID.randomUUID(),
                roomId("Room 405-460"),
                null,
                null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"),
                Instant.parse("2026-08-13T11:00:00Z"),
                null
        )))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Selected class was not found");
    }

    @Test
    void schedulingAgainstAnArchivedClassIsRejected() {
        CourseOffering offering = activeOffering("SOFTENG 789", null);
        offering.setStatus("ARCHIVED");
        courseOfferingRepository.save(offering);

        assertThatThrownBy(() -> classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(),
                roomId("Room 405-460"),
                null,
                null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"),
                Instant.parse("2026-08-13T11:00:00Z"),
                null
        )))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("archived");
    }

    @Test
    void teacherOnlySeesSessionsForClassesTheyTeach() {
        Teacher teacherA = new Teacher();
        teacherA.setStaffNumber("UOA-TCH-A");
        teacherA.setEmail("teacher-a@auckland.ac.nz");
        teacherA.setName("Teacher A");
        teacherRepository.save(teacherA);

        Teacher teacherB = new Teacher();
        teacherB.setStaffNumber("UOA-TCH-B");
        teacherB.setEmail("teacher-b@auckland.ac.nz");
        teacherB.setName("Teacher B");
        teacherRepository.save(teacherB);

        CourseOffering offeringA = activeOffering("SOFTENG 101", teacherA);
        CourseOffering offeringB = activeOffering("SOFTENG 102", teacherB);

        var sessionA = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offeringA.getId(), roomId("Room A"), "teacher-a@auckland.ac.nz", null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"), Instant.parse("2026-08-13T11:00:00Z"), null
        ));
        var sessionB = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offeringB.getId(), roomId("Room B"), "teacher-b@auckland.ac.nz", null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T12:00:00Z"), Instant.parse("2026-08-13T13:00:00Z"), null
        ));

        assertThat(classroomSessionService.listSessions(teacherA.getId()))
                .extracting("id").containsExactly(sessionA.id());
        assertThat(classroomSessionService.listSessions(teacherB.getId()))
                .extracting("id").containsExactly(sessionB.id());
        assertThat(classroomSessionService.listSessions(teacherA.getId(), 0, 20).items())
                .extracting("id").containsExactly(sessionA.id());
        assertThat(classroomSessionService.listSessions(teacherB.getId(), 0, 20).items())
                .extracting("id").containsExactly(sessionB.id());
        assertThat(classroomSessionService.listSessions(teacherA.getId(), 0, 20, "room a").items())
                .extracting("id").containsExactly(sessionA.id());
        assertThat(classroomSessionService.listSessions(teacherA.getId(), 0, 20, "room b").items())
                .isEmpty();
        assertThat(classroomSessionService.listSessions(teacherA.getId(), 0, 20, "2026-08-13").items())
                .extracting("id").containsExactly(sessionA.id());
    }

    @Test
    void adminSeesSessionsAcrossEveryClass() {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-TCH-C");
        teacher.setEmail("teacher-c@auckland.ac.nz");
        teacher.setName("Teacher C");
        teacherRepository.save(teacher);

        Teacher admin = new Teacher();
        admin.setStaffNumber("UOA-ADM");
        admin.setEmail("admin@auckland.ac.nz");
        admin.setName("Admin");
        admin.setRole("ADMIN");
        teacherRepository.save(admin);

        CourseOffering offering = activeOffering("SOFTENG 201", teacher);
        var session = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(), roomId("Room C"), "teacher-c@auckland.ac.nz", null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"), Instant.parse("2026-08-13T11:00:00Z"), null
        ));

        assertThat(classroomSessionService.listSessions(admin.getId()))
                .extracting("id").containsExactly(session.id());
    }

    @Test
    void scheduledSessionWithAPastStartTimeAutoTransitionsToActive() {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-DKESSLER");
        teacher.setEmail("d.kessler@auckland.ac.nz");
        teacher.setName("Dr. Dana Kessler");
        teacherRepository.save(teacher);
        CourseOffering offering = activeOffering("SOFTENG 789", teacher);

        var session = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(), roomId("Room 405-460"), "d.kessler@auckland.ac.nz", null,
                LocalDate.of(2020, 1, 1),
                Instant.parse("2020-01-01T10:00:00Z"), Instant.parse("2099-01-01T11:00:00Z"), null
        ));
        assertThat(session.status()).isEqualTo(SessionStatus.SCHEDULED);

        classroomSessionService.autoTransitionSessions();

        assertThat(classroomSessionRepository.findById(session.id()))
                .get().extracting("status").isEqualTo(SessionStatus.ACTIVE);
    }

    @Test
    void activeSessionWithAPastEndTimeAutoTransitionsToCompleted() {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-DKESSLER");
        teacher.setEmail("d.kessler@auckland.ac.nz");
        teacher.setName("Dr. Dana Kessler");
        teacherRepository.save(teacher);
        CourseOffering offering = activeOffering("SOFTENG 789", teacher);

        var session = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(), roomId("Room 405-460"), "d.kessler@auckland.ac.nz", null,
                LocalDate.of(2020, 1, 1),
                Instant.parse("2020-01-01T10:00:00Z"), Instant.parse("2020-01-01T11:00:00Z"), null
        ));
        classroomSessionService.startSession(session.id());

        classroomSessionService.autoTransitionSessions();

        assertThat(classroomSessionRepository.findById(session.id()))
                .get().extracting("status").isEqualTo(SessionStatus.COMPLETED);
    }

    @Test
    void scheduledSessionWithAFutureStartTimeIsUnaffectedByAutoTransition() {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-DKESSLER");
        teacher.setEmail("d.kessler@auckland.ac.nz");
        teacher.setName("Dr. Dana Kessler");
        teacherRepository.save(teacher);
        CourseOffering offering = activeOffering("SOFTENG 789", teacher);

        var session = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                offering.getId(), roomId("Room 405-460"), "d.kessler@auckland.ac.nz", null,
                LocalDate.of(2099, 1, 1),
                Instant.parse("2099-01-01T10:00:00Z"), Instant.parse("2099-01-01T11:00:00Z"), null
        ));

        classroomSessionService.autoTransitionSessions();

        assertThat(classroomSessionRepository.findById(session.id()))
                .get().extracting("status").isEqualTo(SessionStatus.SCHEDULED);
    }

    // Classes are no longer auto-created by scheduling — a session can only reference a class an
    // Admin already set up, so tests provision one directly the way AdminClassService would.
    private CourseOffering activeOffering(String courseCode, Teacher teacher) {
        Course course = new Course();
        course.setCode(courseCode);
        course.setName(courseCode);
        course = courseRepository.save(course);

        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode(courseCode + " 2026");
        offering.setAcademicTerm("2026 Teaching Year");
        if (teacher != null) {
            offering.getTeachers().add(teacher);
        }
        return courseOfferingRepository.save(offering);
    }

    // Rooms are provisioned by an Admin ahead of time now, scoped to a campus — a session can only
    // reference one that already exists, so tests set one up directly the way RoomService would.
    private UUID roomId(String code) {
        Campus campus = campusRepository.findByNameIgnoreCase("Test Campus")
                .orElseGet(() -> {
                    Campus created = new Campus();
                    created.setName("Test Campus");
                    return campusRepository.save(created);
                });
        return roomRepository.findByCampus_IdAndCodeIgnoreCase(campus.getId(), code)
                .orElseGet(() -> {
                    Room room = new Room();
                    room.setCampus(campus);
                    room.setCode(code);
                    room.setName(code);
                    room.setCapacity(0);
                    return roomRepository.save(room);
                })
                .getId();
    }
}
