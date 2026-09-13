package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ProgressReportResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ProgressReportRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:progress-report-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class ProgressReportServiceTest {
    @Autowired
    private ProgressReportService progressReportService;

    @Autowired
    private ProgressReportRepository progressReportRepository;

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

    private final MockMultipartFile photo =
            new MockMultipartFile("photo", "photo.jpg", "image/jpeg", new byte[] {1, 2, 3});

    @BeforeEach
    void cleanDatabase() {
        progressReportRepository.deleteAll();
        courseEnrollmentRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
        studentRepository.deleteAll();
        teacherRepository.deleteAll();
    }

    @Test
    void creatingAReportSucceedsForTheTeachersOwnClass() {
        Teacher teacher = teacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz", "Dr. Dana Kessler", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        Student student = student();
        enrol(student, offering);

        ProgressReportResponse report = progressReportService.createReport(
                student.getId(), offering.getId(), "Great progress this week.", photo, teacher.getId());

        assertThat(report.teacherName()).isEqualTo("Dr. Dana Kessler");
        assertThat(report.comment()).isEqualTo("Great progress this week.");
        assertThat(report.classLabel()).isEqualTo("SOFTENG 789 · 2026 Teaching Year");
        assertThat(report.photoUrl()).isEqualTo("/api/progress-reports/" + report.id() + "/photo");
    }

    @Test
    void creatingAReportWithoutAPhotoLeavesPhotoUrlNull() {
        Teacher teacher = teacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz", "Dr. Dana Kessler", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        Student student = student();
        enrol(student, offering);

        ProgressReportResponse report = progressReportService.createReport(
                student.getId(), offering.getId(), "Text-only feedback from the web app.", null, teacher.getId());

        assertThat(report.comment()).isEqualTo("Text-only feedback from the web app.");
        assertThat(report.photoUrl()).isNull();
    }

    @Test
    void creatingAReportForAClassYouDontTeachIsRejected() {
        Teacher owner = teacher("UOA-OWNER", "owner@auckland.ac.nz", "Owning Teacher", "TEACHER");
        Teacher outsider = teacher("UOA-OUTSIDER", "outsider@auckland.ac.nz", "Outsider Teacher", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", owner);
        Student student = student();
        enrol(student, offering);

        assertThatThrownBy(() -> progressReportService.createReport(
                student.getId(), offering.getId(), "Note.", photo, outsider.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("your own classes");
    }

    @Test
    void creatingAReportForAStudentNotActivelyEnrolledIsRejected() {
        Teacher teacher = teacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz", "Dr. Dana Kessler", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        Student student = student();

        assertThatThrownBy(() -> progressReportService.createReport(
                student.getId(), offering.getId(), "Note.", photo, teacher.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not actively enrolled");
    }

    @Test
    void listForStudentIsScopedToTheCallersOwnClasses() {
        Teacher teacherA = teacher("UOA-TEACHER-A", "teacher-a@auckland.ac.nz", "Teacher A", "TEACHER");
        Teacher teacherB = teacher("UOA-TEACHER-B", "teacher-b@auckland.ac.nz", "Teacher B", "TEACHER");
        Teacher admin = teacher("UOA-ADMIN", "admin@auckland.ac.nz", "The Admin", "ADMIN");
        CourseOffering offeringA = offering("SOFTENG 789", teacherA);
        CourseOffering offeringB = offering("COMPSCI 730", teacherB);
        Student student = student();
        enrol(student, offeringA);
        enrol(student, offeringB);

        progressReportService.createReport(student.getId(), offeringA.getId(), "From A.", photo, teacherA.getId());
        progressReportService.createReport(student.getId(), offeringB.getId(), "From B.", photo, teacherB.getId());

        assertThat(progressReportService.listForStudent(student.getId(), teacherA.getId()))
                .hasSize(1)
                .allSatisfy(r -> assertThat(r.comment()).isEqualTo("From A."));
        assertThat(progressReportService.listForStudent(student.getId(), teacherB.getId()))
                .hasSize(1)
                .allSatisfy(r -> assertThat(r.comment()).isEqualTo("From B."));
        assertThat(progressReportService.listForStudent(student.getId(), admin.getId())).hasSize(2);
    }

    @Test
    void studentPortalListReturnsEveryReportForThatStudentOnly() {
        Teacher teacher = teacher("UOA-PORTAL", "portal@auckland.ac.nz", "Portal Teacher", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        Student studentA = student();
        Student studentB = student();
        enrol(studentA, offering);
        enrol(studentB, offering);
        progressReportService.createReport(studentA.getId(), offering.getId(), "Visible to A.", null, teacher.getId());
        progressReportService.createReport(studentB.getId(), offering.getId(), "Only for B.", null, teacher.getId());

        assertThat(progressReportService.listForStudentPortal(studentA.getId()))
                .singleElement()
                .satisfies(report -> assertThat(report.comment()).isEqualTo("Visible to A."));
    }

    @Test
    void listForClassReturnsEveryReportForThatOfferingRegardlessOfStudent() {
        Teacher teacher = teacher("UOA-DKESSLER", "d.kessler@auckland.ac.nz", "Dr. Dana Kessler", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        Student studentA = student();
        Student studentB = student();
        enrol(studentA, offering);
        enrol(studentB, offering);
        progressReportService.createReport(studentA.getId(), offering.getId(), "For A.", null, teacher.getId());
        progressReportService.createReport(studentB.getId(), offering.getId(), "For B.", null, teacher.getId());

        assertThat(progressReportService.listForClass(offering.getId(), teacher.getId()))
                .hasSize(2)
                .extracting(ProgressReportResponse::comment)
                .containsExactlyInAnyOrder("For A.", "For B.");
    }

    @Test
    void listForClassIsRejectedForATeacherWhoDoesNotTeachThatClass() {
        Teacher owner = teacher("UOA-OWNER", "owner2@auckland.ac.nz", "Owning Teacher", "TEACHER");
        Teacher outsider = teacher("UOA-OUTSIDER", "outsider2@auckland.ac.nz", "Outsider Teacher", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", owner);

        assertThatThrownBy(() -> progressReportService.listForClass(offering.getId(), outsider.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("your own classes");
    }

    @Test
    void listForClassIsAllowedForAnAdminRegardlessOfWhoTeachesIt() {
        Teacher owner = teacher("UOA-OWNER", "owner3@auckland.ac.nz", "Owning Teacher", "TEACHER");
        Teacher admin = teacher("UOA-ADMIN2", "admin2@auckland.ac.nz", "The Admin", "ADMIN");
        CourseOffering offering = offering("SOFTENG 789", owner);
        Student student = student();
        enrol(student, offering);
        progressReportService.createReport(student.getId(), offering.getId(), "Note.", null, owner.getId());

        assertThat(progressReportService.listForClass(offering.getId(), admin.getId())).hasSize(1);
    }

    @Test
    void listForCallerReturnsOnlyReportsFromClassesTheTeacherTeaches() {
        Teacher teacherA = teacher("UOA-CALLER-A", "caller-a@auckland.ac.nz", "Caller Teacher A", "TEACHER");
        Teacher teacherB = teacher("UOA-CALLER-B", "caller-b@auckland.ac.nz", "Caller Teacher B", "TEACHER");
        CourseOffering offeringA = offering("SOFTENG 789", teacherA);
        CourseOffering offeringB = offering("COMPSCI 730", teacherB);
        Student student = student();
        enrol(student, offeringA);
        enrol(student, offeringB);
        progressReportService.createReport(student.getId(), offeringA.getId(), "From A's class.", null, teacherA.getId());
        progressReportService.createReport(student.getId(), offeringB.getId(), "From B's class.", null, teacherB.getId());

        assertThat(progressReportService.listForCaller(teacherA.getId()))
                .singleElement()
                .satisfies(report -> assertThat(report.comment()).isEqualTo("From A's class."));
    }

    @Test
    void listForCallerReturnsEveryReportForAnAdmin() {
        Teacher teacherA = teacher("UOA-CALLER-C", "caller-c@auckland.ac.nz", "Caller Teacher C", "TEACHER");
        Teacher teacherB = teacher("UOA-CALLER-D", "caller-d@auckland.ac.nz", "Caller Teacher D", "TEACHER");
        Teacher admin = teacher("UOA-CALLER-ADMIN", "caller-admin@auckland.ac.nz", "Caller Admin", "ADMIN");
        CourseOffering offeringA = offering("SOFTENG 789", teacherA);
        CourseOffering offeringB = offering("COMPSCI 730", teacherB);
        Student student = student();
        enrol(student, offeringA);
        enrol(student, offeringB);
        progressReportService.createReport(student.getId(), offeringA.getId(), "From A's class.", null, teacherA.getId());
        progressReportService.createReport(student.getId(), offeringB.getId(), "From B's class.", null, teacherB.getId());

        assertThat(progressReportService.listForCaller(admin.getId())).hasSize(2);
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
        student.setStudentNumber("UOA-PROGRESS-" + suffix);
        student.setUniversityEmail("progress-" + suffix + "@aucklanduni.ac.nz");
        student.setFirstName("Progress");
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
