package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AccomplishmentEntryRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateAccomplishmentsRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Accomplishment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AccomplishmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
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
        "spring.datasource.url=jdbc:h2:mem:accomplishment-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class AccomplishmentServiceTest {
    @Autowired private AccomplishmentService service;
    @Autowired private AccomplishmentRepository accomplishmentRepository;
    @Autowired private CourseEnrollmentRepository enrollmentRepository;
    @Autowired private CourseOfferingRepository offeringRepository;
    @Autowired private CourseRepository courseRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private TeacherRepository teacherRepository;

    @BeforeEach
    void cleanDatabase() {
        accomplishmentRepository.deleteAll();
        enrollmentRepository.deleteAll();
        offeringRepository.deleteAll();
        courseRepository.deleteAll();
        studentRepository.deleteAll();
        teacherRepository.deleteAll();
    }

    @Test
    void teacherCanCreateSeveralConfirmedAccomplishmentsInOneBatch() {
        Teacher teacher = teacher("TEACH-1", "teacher1@example.test", "Teacher One", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);
        Student first = student("1001", "Ada");
        Student second = student("1002", "Grace");
        enrol(first, offering);
        enrol(second, offering);

        var created = service.create(request(
                offering,
                true,
                List.of(
                        new AccomplishmentEntryRequest(first.getId(), new BigDecimal("30"), "Excellent evidence."),
                        new AccomplishmentEntryRequest(second.getId(), new BigDecimal("27.5"), null)
                )), teacher.getId());

        assertThat(created).hasSize(2).allSatisfy(item -> {
            assertThat(item.status()).isEqualTo(Accomplishment.Status.CONFIRMED);
            assertThat(item.confirmedByTeacherName()).isEqualTo("Teacher One");
        });
        assertThat(created).extracting(item -> item.points().stripTrailingZeros())
                .containsExactlyInAnyOrder(new BigDecimal("3E+1"), new BigDecimal("27.5"));
    }

    @Test
    void draftIsHiddenFromStudentUntilTeacherConfirmsIt() {
        Teacher teacher = teacher("TEACH-2", "teacher2@example.test", "Teacher Two", "TEACHER");
        CourseOffering offering = offering("COMPSCI 335", teacher);
        Student student = student("2001", "Katherine");
        enrol(student, offering);
        var draft = service.create(
                request(offering, false, List.of(new AccomplishmentEntryRequest(student.getId(), null, null))),
                teacher.getId()).getFirst();

        assertThat(service.listForStudentPortal(student.getId())).isEmpty();
        service.confirm(draft.id(), teacher.getId());
        assertThat(service.listForStudentPortal(student.getId()))
                .singleElement()
                .satisfies(item -> assertThat(item.status()).isEqualTo(Accomplishment.Status.CONFIRMED));
    }

    @Test
    void revokingAConfirmedAccomplishmentRemovesItFromStudentPortal() {
        Teacher teacher = teacher("TEACH-3", "teacher3@example.test", "Teacher Three", "TEACHER");
        CourseOffering offering = offering("COMPSCI 730", teacher);
        Student student = student("3001", "Dorothy");
        enrol(student, offering);
        var confirmed = service.create(
                request(offering, true, List.of(new AccomplishmentEntryRequest(student.getId(), BigDecimal.TEN, null))),
                teacher.getId()).getFirst();

        service.revoke(confirmed.id(), teacher.getId());

        assertThat(service.listForStudentPortal(student.getId())).isEmpty();
        assertThat(service.list(student.getId(), null, teacher.getId()))
                .singleElement()
                .satisfies(item -> assertThat(item.status()).isEqualTo(Accomplishment.Status.REVOKED));
    }

    @Test
    void teacherCannotRecordAnAccomplishmentOutsideTheirClass() {
        Teacher owner = teacher("TEACH-4", "teacher4@example.test", "Owner", "TEACHER");
        Teacher outsider = teacher("TEACH-5", "teacher5@example.test", "Outsider", "TEACHER");
        CourseOffering offering = offering("INFOSYS 222", owner);
        Student student = student("4001", "Margaret");
        enrol(student, offering);

        assertThatThrownBy(() -> service.create(
                request(offering, true, List.of(new AccomplishmentEntryRequest(student.getId(), null, null))),
                outsider.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("your own classes");
    }

    @Test
    void studentMustBeActivelyEnrolledAndCannotAppearTwiceInABatch() {
        Teacher teacher = teacher("TEACH-6", "teacher6@example.test", "Teacher Six", "TEACHER");
        CourseOffering offering = offering("ENGSCI 233", teacher);
        Student student = student("5001", "Mary");
        var entry = new AccomplishmentEntryRequest(student.getId(), null, null);

        assertThatThrownBy(() -> service.create(request(offering, true, List.of(entry)), teacher.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not actively enrolled");

        enrol(student, offering);
        assertThatThrownBy(() -> service.create(request(offering, true, List.of(entry, entry)), teacher.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("only appear once");
    }

    private CreateAccomplishmentsRequest request(
            CourseOffering offering,
            boolean confirm,
            List<AccomplishmentEntryRequest> entries
    ) {
        return new CreateAccomplishmentsRequest(
                offering.getId(),
                Accomplishment.Category.PROJECT,
                "Completed the 30-point project",
                "Delivered the project milestone.",
                LocalDate.of(2026, 9, 7),
                true,
                confirm,
                entries
        );
    }

    private Teacher teacher(String staffNumber, String email, String name, String role) {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber(staffNumber);
        teacher.setEmail(email);
        teacher.setName(name);
        teacher.setRole(role);
        return teacherRepository.save(teacher);
    }

    private CourseOffering offering(String code, Teacher teacher) {
        Course course = new Course();
        course.setCode(code);
        course.setName(code);
        course = courseRepository.save(course);
        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode(code + " 2026");
        offering.setAcademicTerm("2026 Teaching Year");
        offering.getTeachers().add(teacher);
        return offeringRepository.save(offering);
    }

    private Student student(String number, String firstName) {
        Student student = new Student();
        student.setStudentNumber(number);
        student.setUniversityEmail(number + "@example.test");
        student.setFirstName(firstName);
        student.setLastName("Student");
        student.setCourse("SOFTENG 789");
        student.setSeat("A-01");
        student.setProgramme("Engineering");
        return studentRepository.save(student);
    }

    private void enrol(Student student, CourseOffering offering) {
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourseOffering(offering);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        enrollmentRepository.save(enrollment);
    }
}
