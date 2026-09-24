package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateStudentStatusRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.StudentLevel;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.FaceEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
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

    @Autowired
    private TeacherRepository teacherRepository;

    @BeforeEach
    void cleanDatabase() {
        attendanceRecordRepository.deleteAll();
        faceEnrollmentRepository.deleteAll();
        courseEnrollmentRepository.deleteAll();
        studentRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
        teacherRepository.deleteAll();
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
                true,
                StudentLevel.LEVEL_1
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
                true,
                StudentLevel.LEVEL_1
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
        assertThat(fetched.courseOfferingIds()).containsExactly(offering.getId());
    }

    @Test
    void newStudentStartsActive() {
        var created = studentService.createStudent(new CreateStudentRequest(
                "UOA-WD-001", "uoa-wd-001@aucklanduni.ac.nz", "With", "Draw",
                "SOFTENG 789", List.of("SOFTENG 789"), "B-06", "Master of Engineering Studies", true,
                StudentLevel.LEVEL_1
        ));

        assertThat(created.status()).isEqualTo("ACTIVE");
    }

    @Test
    void withdrawingAStudentWithdrawsAllActiveEnrolments() {
        var created = studentService.createStudent(new CreateStudentRequest(
                "UOA-WD-002", "uoa-wd-002@aucklanduni.ac.nz", "With", "Draw",
                "SOFTENG 789", List.of("SOFTENG 789"), "B-06", "Master of Engineering Studies", true,
                StudentLevel.LEVEL_1
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
                "SOFTENG 789", List.of("SOFTENG 789"), "B-06", "Master of Engineering Studies", true,
                StudentLevel.LEVEL_1
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
    void teacherOnlySeesStudentsEnrolledInClassesTheyTeach() {
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

        var studentA = studentService.createStudent(new CreateStudentRequest(
                "UOA-STU-A", "stu-a@aucklanduni.ac.nz", "Student", "A",
                "SOFTENG 101", List.of("SOFTENG 101"), "B-01", "Master of Engineering Studies", true,
                StudentLevel.LEVEL_1
        ));
        var studentB = studentService.createStudent(new CreateStudentRequest(
                "UOA-STU-B", "stu-b@aucklanduni.ac.nz", "Student", "B",
                "SOFTENG 102", List.of("SOFTENG 102"), "B-02", "Master of Engineering Studies", true,
                StudentLevel.LEVEL_1
        ));

        Course courseA = new Course();
        courseA.setCode("SOFTENG 101");
        courseA.setName("SOFTENG 101");
        courseA = courseRepository.save(courseA);
        CourseOffering offeringA = new CourseOffering();
        offeringA.setCourse(courseA);
        offeringA.setOfferingCode("SOFTENG 101 2026");
        offeringA.setAcademicTerm("2026 Teaching Year");
        offeringA.getTeachers().add(teacherA);
        offeringA = courseOfferingRepository.save(offeringA);

        Course courseB = new Course();
        courseB.setCode("SOFTENG 102");
        courseB.setName("SOFTENG 102");
        courseB = courseRepository.save(courseB);
        CourseOffering offeringB = new CourseOffering();
        offeringB.setCourse(courseB);
        offeringB.setOfferingCode("SOFTENG 102 2026");
        offeringB.setAcademicTerm("2026 Teaching Year");
        offeringB.getTeachers().add(teacherB);
        offeringB = courseOfferingRepository.save(offeringB);

        CourseEnrollment enrollmentA = new CourseEnrollment();
        enrollmentA.setStudent(studentService.findEntity(studentA.id()));
        enrollmentA.setCourseOffering(offeringA);
        enrollmentA.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        courseEnrollmentRepository.save(enrollmentA);

        CourseEnrollment enrollmentB = new CourseEnrollment();
        enrollmentB.setStudent(studentService.findEntity(studentB.id()));
        enrollmentB.setCourseOffering(offeringB);
        enrollmentB.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        courseEnrollmentRepository.save(enrollmentB);

        assertThat(studentService.listStudents(teacherA.getId()))
                .extracting("id").containsExactly(studentA.id());
        assertThat(studentService.listStudents(teacherB.getId()))
                .extracting("id").containsExactly(studentB.id());
    }

    @Test
    void adminSeesAllApprovedStudents() {
        Teacher admin = new Teacher();
        admin.setStaffNumber("UOA-ADM");
        admin.setEmail("admin@auckland.ac.nz");
        admin.setName("Admin");
        admin.setRole("ADMIN");
        teacherRepository.save(admin);

        var student = studentService.createStudent(new CreateStudentRequest(
                "UOA-STU-C", "stu-c@aucklanduni.ac.nz", "Student", "C",
                "SOFTENG 789", List.of("SOFTENG 789"), "B-03", "Master of Engineering Studies", true,
                StudentLevel.LEVEL_1
        ));

        assertThat(studentService.listStudents(admin.getId()))
                .extracting("id").contains(student.id());
    }

    @Test
    void updatingWithAnInvalidStudentStatusValueIsRejected() {
        var created = studentService.createStudent(new CreateStudentRequest(
                "UOA-WD-004", "uoa-wd-004@aucklanduni.ac.nz", "With", "Draw",
                "SOFTENG 789", List.of("SOFTENG 789"), "B-06", "Master of Engineering Studies", true,
                StudentLevel.LEVEL_1
        ));

        assertThatThrownBy(() -> studentService.updateStudentStatus(
                created.id(), new UpdateStudentStatusRequest("GRADUATED")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("ACTIVE or WITHDRAWN");
    }
}
