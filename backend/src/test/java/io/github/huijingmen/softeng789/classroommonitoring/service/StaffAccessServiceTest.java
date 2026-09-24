package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpStatus.FORBIDDEN;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:staff-access-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class StaffAccessServiceTest {
    @Autowired
    private StaffAccessService staffAccessService;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private CourseOfferingRepository courseOfferingRepository;

    @Autowired
    private ClassroomSessionRepository classroomSessionRepository;

    @Autowired
    private CourseEnrollmentRepository courseEnrollmentRepository;

    @BeforeEach
    void cleanDatabase() {
        courseEnrollmentRepository.deleteAll();
        classroomSessionRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
        studentRepository.deleteAll();
        teacherRepository.deleteAll();
    }

    @Test
    void teacherCanAccessOwnOfferingSessionAndActiveStudent() {
        Teacher teacher = saveTeacher("TEACHER", "OWN");
        CourseOffering offering = saveOffering("SOFTENG 789", teacher);
        ClassroomSession session = saveSession(offering, teacher);
        Student student = saveStudent("1000001");
        saveEnrollment(student, offering, CourseEnrollment.EnrollmentStatus.ACTIVE);

        assertThatCode(() -> staffAccessService.requireOfferingAccess(teacher.getId(), offering.getId()))
                .doesNotThrowAnyException();
        assertThatCode(() -> staffAccessService.requireSessionAccess(teacher.getId(), session.getId()))
                .doesNotThrowAnyException();
        assertThatCode(() -> staffAccessService.requireStudentAccess(teacher.getId(), student.getId()))
                .doesNotThrowAnyException();
    }

    @Test
    void teacherCannotAccessAnotherTeachersOfferingSessionOrStudent() {
        Teacher owner = saveTeacher("TEACHER", "OWNER");
        Teacher outsider = saveTeacher("TEACHER", "OUTSIDER");
        CourseOffering offering = saveOffering("COMPSCI 730", owner);
        ClassroomSession session = saveSession(offering, owner);
        Student student = saveStudent("1000002");
        saveEnrollment(student, offering, CourseEnrollment.EnrollmentStatus.ACTIVE);

        assertForbidden(() -> staffAccessService.requireOfferingAccess(outsider.getId(), offering.getId()));
        assertForbidden(() -> staffAccessService.requireSessionAccess(outsider.getId(), session.getId()));
        assertForbidden(() -> staffAccessService.requireStudentAccess(outsider.getId(), student.getId()));
    }

    @Test
    void withdrawnEnrollmentDoesNotGrantTeacherStudentAccess() {
        Teacher teacher = saveTeacher("TEACHER", "WITHDRAWN");
        CourseOffering offering = saveOffering("ENGSCI 233", teacher);
        Student student = saveStudent("1000003");
        saveEnrollment(student, offering, CourseEnrollment.EnrollmentStatus.WITHDRAWN);

        assertForbidden(() -> staffAccessService.requireStudentAccess(teacher.getId(), student.getId()));
    }

    @Test
    void adminCanAccessEveryOfferingSessionAndStudent() {
        Teacher owner = saveTeacher("TEACHER", "CLASS-OWNER");
        Teacher admin = saveTeacher("ADMIN", "ADMIN");
        CourseOffering offering = saveOffering("INFOSYS 222", owner);
        ClassroomSession session = saveSession(offering, owner);
        Student student = saveStudent("1000004");

        assertThatCode(() -> staffAccessService.requireOfferingAccess(admin.getId(), offering.getId()))
                .doesNotThrowAnyException();
        assertThatCode(() -> staffAccessService.requireSessionAccess(admin.getId(), session.getId()))
                .doesNotThrowAnyException();
        assertThatCode(() -> staffAccessService.requireStudentAccess(admin.getId(), student.getId()))
                .doesNotThrowAnyException();
    }

    @Test
    void legacySessionWithoutOfferingIsLimitedToItsAssignedTeacher() {
        Teacher owner = saveTeacher("TEACHER", "LEGACY-OWNER");
        Teacher outsider = saveTeacher("TEACHER", "LEGACY-OUTSIDER");
        ClassroomSession session = saveSession(null, owner);

        assertThatCode(() -> staffAccessService.requireSessionAccess(owner.getId(), session.getId()))
                .doesNotThrowAnyException();
        assertForbidden(() -> staffAccessService.requireSessionAccess(outsider.getId(), session.getId()));
    }

    @Test
    void batchSessionAccessRejectsTheWholeRequestWhenAnySessionIsOutsideTeacherScope() {
        Teacher teacher = saveTeacher("TEACHER", "BATCH-OWNER");
        Teacher other = saveTeacher("TEACHER", "BATCH-OTHER");
        ClassroomSession owned = saveSession(saveOffering("SOFTENG 789", teacher), teacher);
        ClassroomSession outsideScope = saveSession(saveOffering("COMPSCI 730", other), other);

        assertForbidden(() -> staffAccessService.requireSessionAccess(
                teacher.getId(), List.of(owned.getId(), outsideScope.getId())));
    }

    private Teacher saveTeacher(String role, String suffix) {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-" + suffix);
        teacher.setEmail(suffix.toLowerCase() + "@auckland.ac.nz");
        teacher.setName(suffix + " Staff");
        teacher.setRole(role);
        teacher.setStatus("ACTIVE");
        return teacherRepository.save(teacher);
    }

    private CourseOffering saveOffering(String code, Teacher teacher) {
        Course course = new Course();
        course.setCode(code);
        course.setName(code + " Course");
        courseRepository.save(course);

        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode(code + "-2026");
        offering.setAcademicTerm("2026 Teaching Year");
        offering.getTeachers().add(teacher);
        return courseOfferingRepository.save(offering);
    }

    private ClassroomSession saveSession(CourseOffering offering, Teacher teacher) {
        ClassroomSession session = new ClassroomSession();
        session.setCourse(offering == null ? "LEGACY 101" : offering.getCourse().getCode());
        session.setRoom("Room 1");
        session.setCourseOffering(offering);
        session.setTeacher(teacher);
        session.setDate(LocalDate.of(2026, 9, 23));
        session.setStartTime(Instant.parse("2026-09-23T00:00:00Z"));
        session.setEndTime(Instant.parse("2026-09-23T01:00:00Z"));
        return classroomSessionRepository.save(session);
    }

    private Student saveStudent(String studentNumber) {
        Student student = new Student();
        student.setStudentNumber(studentNumber);
        student.setUniversityEmail(studentNumber + "@aucklanduni.ac.nz");
        student.setFirstName("Test");
        student.setLastName(studentNumber);
        student.setCourse("SOFTENG");
        student.setSeat("Unassigned");
        student.setProgramme("Engineering");
        student.setConsentGiven(true);
        return studentRepository.save(student);
    }

    private void saveEnrollment(
            Student student,
            CourseOffering offering,
            CourseEnrollment.EnrollmentStatus status
    ) {
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourseOffering(offering);
        enrollment.setStatus(status);
        courseEnrollmentRepository.save(enrollment);
    }

    private void assertForbidden(Runnable accessAttempt) {
        assertThatThrownBy(accessAttempt::run)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> org.assertj.core.api.Assertions.assertThat(exception.getStatusCode())
                                .isEqualTo(FORBIDDEN));
    }
}
