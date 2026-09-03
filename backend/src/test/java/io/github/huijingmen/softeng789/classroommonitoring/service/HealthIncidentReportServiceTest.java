package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateHealthIncidentReportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthIncidentReportFilter;
import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthIncidentReportResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentOptionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.HealthIncidentReportRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:health-incident-report-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class HealthIncidentReportServiceTest {
    @Autowired
    private HealthIncidentReportService healthIncidentReportService;

    @Autowired
    private HealthIncidentReportRepository healthIncidentReportRepository;

    @Autowired
    private CourseEnrollmentRepository courseEnrollmentRepository;

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
        courseEnrollmentRepository.deleteAll();
        classroomSessionRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
        studentRepository.deleteAll();
        teacherRepository.deleteAll();
    }

    @Test
    void creatingAManualReportSucceedsForTheTeachersOwnClass() {
        Teacher teacher = teacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz", "Dr. Dana Kessler", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        Student student = student();
        enrol(student, offering);

        HealthIncidentReportResponse report = healthIncidentReportService.createManualReport(
                new CreateHealthIncidentReportRequest(
                        student.getId(), offering.getId(), null, "Fever / Feeling unwell",
                        Instant.parse("2026-08-13T09:00:00Z"), "Felt dizzy after lunch.",
                        "Sent to first aid.", "Parent notified."),
                teacher.getId());

        assertThat(report.source()).isEqualTo("TEACHER_REPORTED");
        assertThat(report.healthAlertId()).isNull();
        assertThat(report.teacherName()).isEqualTo("Dr. Dana Kessler");
        assertThat(report.description()).isEqualTo("Felt dizzy after lunch.");
        assertThat(report.actionTaken()).isEqualTo("Sent to first aid.");
        assertThat(report.classLabel()).isEqualTo("SOFTENG 789 · 2026 Teaching Year");
    }

    @Test
    void creatingAManualReportForAClassYouDontTeachIsRejected() {
        Teacher owner = teacher("UOA-OWNER", "owner@auckland.ac.nz", "Owning Teacher", "TEACHER");
        Teacher outsider = teacher("UOA-OUTSIDER", "outsider@auckland.ac.nz", "Outsider Teacher", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", owner);
        Student student = student();
        enrol(student, offering);

        assertThatThrownBy(() -> healthIncidentReportService.createManualReport(
                new CreateHealthIncidentReportRequest(
                        student.getId(), offering.getId(), null, "Fall",
                        Instant.parse("2026-08-13T09:00:00Z"), "Fell in the hallway.", null, null),
                outsider.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("your own classes");
    }

    @Test
    void creatingAManualReportForAStudentNotActivelyEnrolledIsRejected() {
        Teacher teacher = teacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz", "Dr. Dana Kessler", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        Student student = student();

        assertThatThrownBy(() -> healthIncidentReportService.createManualReport(
                new CreateHealthIncidentReportRequest(
                        student.getId(), offering.getId(), null, "Injury",
                        Instant.parse("2026-08-13T09:00:00Z"), "Twisted an ankle.", null, null),
                teacher.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not actively enrolled");
    }

    @Test
    void listMyClassesReturnsOnlyTheCallersOwnClassesWithRoster() {
        Teacher teacherA = teacher("UOA-TEACHER-A", "teacher-a@auckland.ac.nz", "Teacher A", "TEACHER");
        Teacher teacherB = teacher("UOA-TEACHER-B", "teacher-b@auckland.ac.nz", "Teacher B", "TEACHER");
        Teacher admin = teacher("UOA-ADMIN", "admin@auckland.ac.nz", "The Admin", "ADMIN");
        CourseOffering offeringA = offering("SOFTENG 789", teacherA);
        CourseOffering offeringB = offering("COMPSCI 730", teacherB);
        Student studentA = student();
        enrol(studentA, offeringA);

        var forTeacherA = healthIncidentReportService.listMyClasses(teacherA.getId());
        assertThat(forTeacherA).hasSize(1);
        assertThat(forTeacherA.get(0).label()).isEqualTo("SOFTENG 789 · 2026 Teaching Year");
        assertThat(forTeacherA.get(0).students())
                .extracting(StudentOptionResponse::id)
                .containsExactly(studentA.getId());

        assertThat(healthIncidentReportService.listMyClasses(teacherB.getId()))
                .hasSize(1)
                .allSatisfy(option -> assertThat(option.label()).startsWith("COMPSCI 730"));

        assertThat(healthIncidentReportService.listMyClasses(admin.getId())).hasSize(2);
    }

    @Test
    void listReportsIsScopedToTheCallersOwnClasses() {
        Teacher teacherA = teacher("UOA-TEACHER-A", "teacher-a@auckland.ac.nz", "Teacher A", "TEACHER");
        Teacher teacherB = teacher("UOA-TEACHER-B", "teacher-b@auckland.ac.nz", "Teacher B", "TEACHER");
        Teacher admin = teacher("UOA-ADMIN", "admin@auckland.ac.nz", "The Admin", "ADMIN");
        CourseOffering offeringA = offering("SOFTENG 789", teacherA);
        CourseOffering offeringB = offering("COMPSCI 730", teacherB);
        Student studentA = student();
        Student studentB = student();
        enrol(studentA, offeringA);
        enrol(studentB, offeringB);

        healthIncidentReportService.createManualReport(new CreateHealthIncidentReportRequest(
                studentA.getId(), offeringA.getId(), null, "Fall",
                Instant.parse("2026-08-13T09:00:00Z"), "Fell over.", null, null), teacherA.getId());
        healthIncidentReportService.createManualReport(new CreateHealthIncidentReportRequest(
                studentB.getId(), offeringB.getId(), null, "Nosebleed",
                Instant.parse("2026-08-13T09:00:00Z"), "Nosebleed in class.", null, null), teacherB.getId());

        assertThat(healthIncidentReportService.listReports(teacherA.getId(), HealthIncidentReportFilter.NONE))
                .hasSize(1)
                .allSatisfy(r -> assertThat(r.classLabel()).startsWith("SOFTENG 789"));
        assertThat(healthIncidentReportService.listReports(admin.getId(), HealthIncidentReportFilter.NONE))
                .hasSize(2);
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
        student.setLastName("Report");
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

    private void enrol(Student student, CourseOffering offering) {
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourseOffering(offering);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        courseEnrollmentRepository.save(enrollment);
    }

}
