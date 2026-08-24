package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassroomSessionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.Instant;
import java.time.LocalDate;
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

    @BeforeEach
    void cleanDatabase() {
        attendanceRecordRepository.deleteAll();
        classroomSessionRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        teacherRepository.deleteAll();
    }

    @Test
    void scheduledSessionCanStartAndEnd() {
        // Sessions can only reference an already-registered teacher (or the default) — creating a
        // session no longer silently mints a claimable teacher record for an arbitrary email.
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-DKESSLER");
        teacher.setEmail("d.kessler@auckland.ac.nz");
        teacher.setName("Dr. Dana Kessler");
        teacherRepository.save(teacher);

        var created = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                "SOFTENG 789",
                "Room 405-460",
                "Dr. Dana Kessler",
                "d.kessler@auckland.ac.nz",
                "UOA-DKESSLER",
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"),
                Instant.parse("2026-08-13T11:00:00Z"),
                null
        ));

        assertThat(created.status()).isEqualTo(SessionStatus.SCHEDULED);
        assertThat(created.course()).isEqualTo("SOFTENG 789");
        assertThat(created.courseOfferingId()).isNotNull();
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
    void schedulingWithAnUnregisteredTeacherEmailIsRejected() {
        assertThatThrownBy(() -> classroomSessionService.createSession(new CreateClassroomSessionRequest(
                "SOFTENG 789",
                "Room 405-460",
                "Prof Unknown",
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
    void schedulingWithNoTeacherSpecifiedFallsBackToTheSharedDefault() {
        assertThat(teacherRepository.findByEmailIgnoreCase("unassigned.teacher@auckland.ac.nz")).isEmpty();

        var created = classroomSessionService.createSession(new CreateClassroomSessionRequest(
                "SOFTENG 789",
                "Room 405-460",
                null,
                null,
                null,
                LocalDate.of(2026, 8, 13),
                Instant.parse("2026-08-13T10:00:00Z"),
                Instant.parse("2026-08-13T11:00:00Z"),
                null
        ));

        assertThat(created.teacherName()).isEqualTo("Unassigned Teacher");
        assertThat(teacherRepository.findByEmailIgnoreCase("unassigned.teacher@auckland.ac.nz")).isPresent();
    }
}
