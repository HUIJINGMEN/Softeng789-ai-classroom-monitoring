package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ConfirmHealthAlertRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.DismissHealthAlertRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthAlertFilter;
import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthAlertResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.IngestHealthEventRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.HealthAlertRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.HealthIncidentReportRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.math.BigDecimal;
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
        "spring.datasource.url=jdbc:h2:mem:health-alert-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class HealthAlertServiceTest {
    @Autowired
    private HealthAlertService healthAlertService;

    @Autowired
    private HealthAlertRepository healthAlertRepository;

    @Autowired
    private HealthIncidentReportRepository healthIncidentReportRepository;

    @Autowired
    private ClassroomSessionRepository classroomSessionRepository;

    @Autowired
    private CourseOfferingRepository courseOfferingRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @BeforeEach
    void cleanDatabase() {
        healthIncidentReportRepository.deleteAll();
        healthAlertRepository.deleteAll();
        classroomSessionRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
        studentRepository.deleteAll();
        teacherRepository.deleteAll();
    }

    @Test
    void ingestingAnEventCreatesAnAwaitingReviewAlertWithMappedEventType() {
        Teacher teacher = teacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz", "Dr. Dana Kessler", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        Student student = student();
        ClassroomSession session = session(offering);

        HealthAlertResponse alert = healthAlertService.ingestAlert(new IngestHealthEventRequest(
                student.getId(), session.getId(), "possible fall", new BigDecimal("0.910"), null, null));

        assertThat(alert.status()).isEqualTo("AWAITING_REVIEW");
        assertThat(alert.source()).isEqualTo("AI_SERVICE");
        assertThat(alert.eventType()).isEqualTo("Fall");
        assertThat(alert.studentName()).isEqualTo("Health Alert");
        assertThat(alert.classLabel()).isEqualTo("SOFTENG 789 · 2026 Teaching Year");
        assertThat(alert.room()).isEqualTo("Room 405-460");
        assertThat(alert.detectedAt()).isNotNull();
        assertThat(alert.confidence()).isEqualByComparingTo("0.910");
    }

    @Test
    void confirmingAnAlertCreatesALinkedHealthIncidentReport() {
        Teacher teacher = teacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz", "Dr. Dana Kessler", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        Student student = student();
        ClassroomSession session = session(offering);
        HealthAlertResponse alert = healthAlertService.ingestAlert(new IngestHealthEventRequest(
                student.getId(), session.getId(), "Nosebleed", null, null, null));

        HealthAlertResponse confirmed = healthAlertService.confirmAlert(alert.id(), teacher.getId(),
                new ConfirmHealthAlertRequest(null, "Student slipped while standing up.",
                        "Checked the student and confirmed no further assistance was required."));

        assertThat(confirmed.status()).isEqualTo("CONFIRMED");
        assertThat(confirmed.reviewedByTeacherName()).isEqualTo("Dr. Dana Kessler");
        assertThat(confirmed.teacherNotes()).isEqualTo("Student slipped while standing up.");

        var reports = healthIncidentReportRepository.findAllByOrderByCreatedAtDesc();
        assertThat(reports).hasSize(1);
        assertThat(reports.get(0).getSource()).isEqualTo("AI_DETECTED");
        assertThat(reports.get(0).getHealthAlert().getId()).isEqualTo(alert.id());
        assertThat(reports.get(0).getIncidentType()).isEqualTo("Nosebleed");
        assertThat(reports.get(0).getTeacherNotes()).isEqualTo("Student slipped while standing up.");
    }

    @Test
    void confirmingCanCorrectTheEventTypeFirst() {
        Teacher teacher = teacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz", "Dr. Dana Kessler", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        Student student = student();
        ClassroomSession session = session(offering);
        HealthAlertResponse alert = healthAlertService.ingestAlert(new IngestHealthEventRequest(
                student.getId(), session.getId(), "Other", null, null, null));

        HealthAlertResponse confirmed = healthAlertService.confirmAlert(
                alert.id(), teacher.getId(), new ConfirmHealthAlertRequest("Fall", null, null));

        assertThat(confirmed.eventType()).isEqualTo("Fall");
        assertThat(healthIncidentReportRepository.findAllByOrderByCreatedAtDesc().get(0).getIncidentType())
                .isEqualTo("Fall");
    }

    @Test
    void confirmingAnAlreadyReviewedAlertIsRejected() {
        Teacher teacher = teacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz", "Dr. Dana Kessler", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        ClassroomSession session = session(offering);
        HealthAlertResponse alert = healthAlertService.ingestAlert(new IngestHealthEventRequest(
                student().getId(), session.getId(), "Fall", null, null, null));
        healthAlertService.confirmAlert(alert.id(), teacher.getId(), new ConfirmHealthAlertRequest(null, null, null));

        assertThatThrownBy(() -> healthAlertService.confirmAlert(
                alert.id(), teacher.getId(), new ConfirmHealthAlertRequest(null, null, null)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already been reviewed");
    }

    @Test
    void dismissingAnAlertDoesNotCreateAReport() {
        Teacher teacher = teacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz", "Dr. Dana Kessler", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        ClassroomSession session = session(offering);
        HealthAlertResponse alert = healthAlertService.ingestAlert(new IngestHealthEventRequest(
                student().getId(), session.getId(), "Fall", null, null, null));

        HealthAlertResponse dismissed = healthAlertService.dismissAlert(
                alert.id(), teacher.getId(), new DismissHealthAlertRequest("False alarm — just sitting down."));

        assertThat(dismissed.status()).isEqualTo("DISMISSED");
        assertThat(dismissed.teacherNotes()).isEqualTo("False alarm — just sitting down.");
        assertThat(healthIncidentReportRepository.findAllByOrderByCreatedAtDesc()).isEmpty();
    }

    @Test
    void listAlertsIsScopedToTheCallersOwnClasses() {
        Teacher teacherA = teacher("UOA-TEACHER-A", "teacher-a@auckland.ac.nz", "Teacher A", "TEACHER");
        Teacher teacherB = teacher("UOA-TEACHER-B", "teacher-b@auckland.ac.nz", "Teacher B", "TEACHER");
        Teacher admin = teacher("UOA-ADMIN", "admin@auckland.ac.nz", "The Admin", "ADMIN");
        CourseOffering offeringA = offering("SOFTENG 789", teacherA);
        CourseOffering offeringB = offering("COMPSCI 730", teacherB);
        ClassroomSession sessionA = session(offeringA);
        ClassroomSession sessionB = session(offeringB);

        healthAlertService.ingestAlert(new IngestHealthEventRequest(
                student().getId(), sessionA.getId(), "Fall", null, null, null));
        healthAlertService.ingestAlert(new IngestHealthEventRequest(
                student().getId(), sessionB.getId(), "Nosebleed", null, null, null));

        assertThat(healthAlertService.listAlerts(teacherA.getId(), HealthAlertFilter.NONE))
                .hasSize(1)
                .allSatisfy(a -> assertThat(a.classLabel()).startsWith("SOFTENG 789"));
        assertThat(healthAlertService.listAlerts(teacherB.getId(), HealthAlertFilter.NONE))
                .hasSize(1)
                .allSatisfy(a -> assertThat(a.classLabel()).startsWith("COMPSCI 730"));
        assertThat(healthAlertService.listAlerts(admin.getId(), HealthAlertFilter.NONE)).hasSize(2);
    }

    @Test
    void accessingAnAlertOutsideYourOwnClassIsForbidden() {
        Teacher owner = teacher("UOA-OWNER", "owner@auckland.ac.nz", "Owning Teacher", "TEACHER");
        Teacher outsider = teacher("UOA-OUTSIDER", "outsider@auckland.ac.nz", "Outsider Teacher", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", owner);
        ClassroomSession session = session(offering);
        HealthAlertResponse alert = healthAlertService.ingestAlert(new IngestHealthEventRequest(
                student().getId(), session.getId(), "Fall", null, null, null));

        assertThatThrownBy(() -> healthAlertService.getAlert(alert.id(), outsider.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("your own classes");
    }

    private Teacher teacher(String staffNumber, String email, String name, String role) {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber(staffNumber);
        teacher.setEmail(email);
        teacher.setName(name);
        teacher.setRole(role);
        return teacherRepository.save(teacher);
    }

    private Student student() {
        Student student = new Student();
        String suffix = String.valueOf(System.nanoTime());
        student.setStudentNumber("UOA-HEALTH-" + suffix);
        student.setUniversityEmail("health-" + suffix + "@aucklanduni.ac.nz");
        student.setFirstName("Health");
        student.setLastName("Alert");
        student.setCourse("SOFTENG 789");
        student.setSeat("B-01");
        student.setProgramme("Master of Engineering Studies");
        return studentRepository.save(student);
    }

    private CourseOffering offering(String courseCode, Teacher teacher) {
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

    private ClassroomSession session(CourseOffering offering) {
        ClassroomSession session = new ClassroomSession();
        session.setCourse(offering.getCourse().getCode());
        session.setCourseOffering(offering);
        session.setRoom("Room 405-460");
        session.setDate(LocalDate.of(2026, 8, 13));
        session.setStartTime(Instant.parse("2026-08-13T10:00:00Z"));
        session.setEndTime(Instant.parse("2026-08-13T11:00:00Z"));
        session.setStatus(SessionStatus.ACTIVE);
        return classroomSessionRepository.save(session);
    }
}
