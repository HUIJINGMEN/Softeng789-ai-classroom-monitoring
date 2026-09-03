package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateStudentStatusRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.FaceEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:student-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class StudentServiceTest {
    @Autowired
    private StudentService studentService;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private FaceEnrollmentRepository faceEnrollmentRepository;

    @Autowired
    private CourseEnrollmentRepository courseEnrollmentRepository;

    @Autowired
    private CourseOfferingRepository courseOfferingRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private StudentRepository studentRepository;

    @BeforeEach
    void cleanDatabase() {
        attendanceRecordRepository.deleteAll();
        faceEnrollmentRepository.deleteAll();
        courseEnrollmentRepository.deleteAll();
        studentRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
    }

    @Test
    void creatingAStudentDoesNotAutoCreateCoursesOrEnrolments() {
        // course/courses on the request are purely descriptive now — Admin assigns real classes
        // separately (see AdminClassService), so registering a student no longer mints Course rows
        // or enrolments on its own the way it used to.
        var created = studentService.createStudent(new CreateStudentRequest(
                "UOA-MULTI-001",
                "uoa-multi-001@aucklanduni.ac.nz",
                "Multi",
                "Course",
                "SOFTENG 789",
                List.of("SOFTENG 789", "COMPSCI 730"),
                "B-04",
                "Master of Engineering Studies",
                true
        ));

        assertThat(created.course()).isEqualTo("SOFTENG 789");
        assertThat(created.courses()).containsExactly("SOFTENG 789");
        assertThat(courseRepository.findByCodeIgnoreCase("SOFTENG 789")).isEmpty();
        assertThat(courseRepository.findByCodeIgnoreCase("COMPSCI 730")).isEmpty();
        assertThat(courseEnrollmentRepository.findByStudent_IdOrderByCourseOffering_Course_CodeAsc(created.id()))
                .isEmpty();
    }

    @Test
    void studentResponseReflectsRealClassEnrolments() {
        var created = studentService.createStudent(new CreateStudentRequest(
                "UOA-CLASS-001",
                "uoa-class-001@aucklanduni.ac.nz",
                "Class",
                "Assigned",
                "SOFTENG 789",
                List.of("SOFTENG 789"),
                "B-05",
                "Master of Engineering Studies",
                true
        ));

        Course course = new Course();
        course.setCode("SOFTENG 789");
        course.setName("SOFTENG 789");
        course = courseRepository.save(course);

        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode("SOFTENG 789 2026");
        offering.setAcademicTerm("2026 Teaching Year");
        offering = courseOfferingRepository.save(offering);

        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(studentService.findEntity(created.id()));
        enrollment.setCourseOffering(offering);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        courseEnrollmentRepository.save(enrollment);

        var fetched = studentService.getStudent(created.id());
        assertThat(fetched.courses()).containsExactly("SOFTENG 789");
    }

    @Test
    void newStudentStartsActive() {
        var created = studentService.createStudent(new CreateStudentRequest(
                "UOA-WD-001", "uoa-wd-001@aucklanduni.ac.nz", "With", "Draw",
                "SOFTENG 789", List.of("SOFTENG 789"), "B-06", "Master of Engineering Studies", true
        ));

        assertThat(created.status()).isEqualTo("ACTIVE");
    }

    @Test
    void withdrawingAStudentWithdrawsAllActiveEnrolments() {
        var created = studentService.createStudent(new CreateStudentRequest(
                "UOA-WD-002", "uoa-wd-002@aucklanduni.ac.nz", "With", "Draw",
                "SOFTENG 789", List.of("SOFTENG 789"), "B-06", "Master of Engineering Studies", true
        ));

        Course course = new Course();
        course.setCode("SOFTENG 789");
        course.setName("SOFTENG 789");
        course = courseRepository.save(course);

        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode("SOFTENG 789 2026");
        offering.setAcademicTerm("2026 Teaching Year");
        offering = courseOfferingRepository.save(offering);

        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(studentService.findEntity(created.id()));
        enrollment.setCourseOffering(offering);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        enrollment = courseEnrollmentRepository.save(enrollment);

        var withdrawn = studentService.updateStudentStatus(created.id(), new UpdateStudentStatusRequest("WITHDRAWN"));

        assertThat(withdrawn.status()).isEqualTo("WITHDRAWN");
        assertThat(courseEnrollmentRepository.findById(enrollment.getId()))
                .get()
                .extracting("status")
                .isEqualTo(CourseEnrollment.EnrollmentStatus.WITHDRAWN);
    }

    @Test
    void reactivatingAStudentDoesNotAutoRestoreEnrolments() {
        var created = studentService.createStudent(new CreateStudentRequest(
                "UOA-WD-003", "uoa-wd-003@aucklanduni.ac.nz", "With", "Draw",
                "SOFTENG 789", List.of("SOFTENG 789"), "B-06", "Master of Engineering Studies", true
        ));

        Course course = new Course();
        course.setCode("SOFTENG 789");
        course.setName("SOFTENG 789");
        course = courseRepository.save(course);

        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode("SOFTENG 789 2026");
        offering.setAcademicTerm("2026 Teaching Year");
        offering = courseOfferingRepository.save(offering);

        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(studentService.findEntity(created.id()));
        enrollment.setCourseOffering(offering);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        enrollment = courseEnrollmentRepository.save(enrollment);

        studentService.updateStudentStatus(created.id(), new UpdateStudentStatusRequest("WITHDRAWN"));
        var reactivated = studentService.updateStudentStatus(created.id(), new UpdateStudentStatusRequest("ACTIVE"));

        assertThat(reactivated.status()).isEqualTo("ACTIVE");
        assertThat(courseEnrollmentRepository.findById(enrollment.getId()))
                .get()
                .extracting("status")
                .isEqualTo(CourseEnrollment.EnrollmentStatus.WITHDRAWN);
    }

    @Test
    void updatingWithAnInvalidStudentStatusValueIsRejected() {
        var created = studentService.createStudent(new CreateStudentRequest(
                "UOA-WD-004", "uoa-wd-004@aucklanduni.ac.nz", "With", "Draw",
                "SOFTENG 789", List.of("SOFTENG 789"), "B-06", "Master of Engineering Studies", true
        ));

        assertThatThrownBy(() -> studentService.updateStudentStatus(
                created.id(), new UpdateStudentStatusRequest("GRADUATED")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("ACTIVE or WITHDRAWN");
    }
}
