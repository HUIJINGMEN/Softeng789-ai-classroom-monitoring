package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AccomplishmentEntryRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateAccomplishmentsRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ReviewAccomplishmentCorrectionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Accomplishment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AccomplishmentFeedback;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AccomplishmentFeedbackRepository;
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
        "spring.datasource.url=jdbc:h2:mem:accomplishment-feedback-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class AccomplishmentFeedbackServiceTest {
    @Autowired private AccomplishmentFeedbackService feedbackService;
    @Autowired private AccomplishmentService accomplishmentService;
    @Autowired private AccomplishmentFeedbackRepository feedbackRepository;
    @Autowired private AccomplishmentRepository accomplishmentRepository;
    @Autowired private CourseEnrollmentRepository enrollmentRepository;
    @Autowired private CourseOfferingRepository offeringRepository;
    @Autowired private CourseRepository courseRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private TeacherRepository teacherRepository;

    private Teacher teacher;
    private CourseOffering offering;
    private Student student;
    private Accomplishment accomplishment;

    @BeforeEach
    void setUp() {
        feedbackRepository.deleteAll();
        accomplishmentRepository.deleteAll();
        enrollmentRepository.deleteAll();
        offeringRepository.deleteAll();
        courseRepository.deleteAll();
        studentRepository.deleteAll();
        teacherRepository.deleteAll();

        teacher = teacher("TEACH-1", "teacher@example.test", "Teacher One");
        offering = offering("SOFTENG 789", teacher);
        student = student("1001", "Ada");
        enrol(student, offering);
        accomplishment = accomplishmentRepository.findById(accomplishmentService.create(
                createRequest(offering, student), teacher.getId()).getFirst().id()).orElseThrow();
    }

    @Test
    void studentCanAcknowledgeAPublishedRecordOnlyOnce() {
        var first = feedbackService.acknowledge(accomplishment.getId(), student.getId());
        var second = feedbackService.acknowledge(accomplishment.getId(), student.getId());

        assertThat(first.acknowledgedAt()).isNotNull();
        assertThat(second.acknowledgedAt()).isEqualTo(first.acknowledgedAt());
        assertThat(feedbackRepository.count()).isOne();
    }

    @Test
    void studentCanHaveOnlyOnePendingCorrectionRequest() {
        var response = feedbackService.requestCorrection(
                accomplishment.getId(), student.getId(), "The completion date should be 6 September."
        );

        assertThat(response.latestCorrection()).satisfies(correction -> {
            assertThat(correction.status()).isEqualTo(AccomplishmentFeedback.Status.PENDING);
            assertThat(correction.message()).contains("6 September");
        });
        assertThatThrownBy(() -> feedbackService.requestCorrection(
                accomplishment.getId(), student.getId(), "A second request."
        )).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already has a correction request");
    }

    @Test
    void acceptingARequestUpdatesTheOfficialRecordAndRetainsTheOutcome() {
        feedbackService.requestCorrection(
                accomplishment.getId(), student.getId(), "The title and points need updating."
        );

        var response = feedbackService.reviewCorrection(
                accomplishment.getId(),
                reviewRequest(AccomplishmentFeedback.Status.ACCEPTED, "Completed the final project", "Updated as requested."),
                teacher.getId()
        );

        assertThat(response.title()).isEqualTo("Completed the final project");
        assertThat(response.points()).isEqualByComparingTo("30");
        assertThat(response.latestCorrection()).satisfies(correction -> {
            assertThat(correction.status()).isEqualTo(AccomplishmentFeedback.Status.ACCEPTED);
            assertThat(correction.reviewedByTeacherName()).isEqualTo("Teacher One");
            assertThat(correction.staffResponse()).isEqualTo("Updated as requested.");
        });
    }

    @Test
    void decliningARequestRequiresAnExplanationAndDoesNotAlterTheRecord() {
        feedbackService.requestCorrection(
                accomplishment.getId(), student.getId(), "The current title is incorrect."
        );

        assertThatThrownBy(() -> feedbackService.reviewCorrection(
                accomplishment.getId(),
                reviewRequest(AccomplishmentFeedback.Status.DECLINED, "Changed title", ""),
                teacher.getId()
        )).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Explain why");

        var response = feedbackService.reviewCorrection(
                accomplishment.getId(),
                reviewRequest(AccomplishmentFeedback.Status.DECLINED, "Changed title", "The original evidence is correct."),
                teacher.getId()
        );
        assertThat(response.title()).isEqualTo("Completed the project");
        assertThat(response.latestCorrection().status()).isEqualTo(AccomplishmentFeedback.Status.DECLINED);
    }

    @Test
    void anotherStudentCannotRespondToThisRecord() {
        Student anotherStudent = student("1002", "Grace");

        assertThatThrownBy(() -> feedbackService.acknowledge(accomplishment.getId(), anotherStudent.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("your own accomplishments");
    }

    private CreateAccomplishmentsRequest createRequest(CourseOffering courseOffering, Student recipient) {
        return new CreateAccomplishmentsRequest(
                courseOffering.getId(),
                Accomplishment.Category.PROJECT,
                "Completed the project",
                "Delivered the project milestone.",
                LocalDate.of(2026, 9, 7),
                true,
                true,
                List.of(new AccomplishmentEntryRequest(recipient.getId(), new BigDecimal("25"), null))
        );
    }

    private ReviewAccomplishmentCorrectionRequest reviewRequest(
            AccomplishmentFeedback.Status decision,
            String title,
            String response
    ) {
        return new ReviewAccomplishmentCorrectionRequest(
                decision,
                Accomplishment.Category.PROJECT,
                title,
                "Delivered the final project milestone.",
                "Well documented.",
                new BigDecimal("30"),
                LocalDate.of(2026, 9, 6),
                true,
                response
        );
    }

    private Teacher teacher(String staffNumber, String email, String name) {
        Teacher row = new Teacher();
        row.setStaffNumber(staffNumber);
        row.setEmail(email);
        row.setName(name);
        row.setRole("TEACHER");
        return teacherRepository.save(row);
    }

    private CourseOffering offering(String code, Teacher owner) {
        Course course = new Course();
        course.setCode(code);
        course.setName(code);
        course = courseRepository.save(course);
        CourseOffering row = new CourseOffering();
        row.setCourse(course);
        row.setOfferingCode(code + " 2026");
        row.setAcademicTerm("2026 Teaching Year");
        row.getTeachers().add(owner);
        return offeringRepository.save(row);
    }

    private Student student(String number, String firstName) {
        Student row = new Student();
        row.setStudentNumber(number);
        row.setUniversityEmail(number + "@example.test");
        row.setFirstName(firstName);
        row.setLastName("Student");
        row.setCourse("SOFTENG 789");
        row.setSeat("A-01");
        row.setProgramme("Engineering");
        return studentRepository.save(row);
    }

    private void enrol(Student recipient, CourseOffering courseOffering) {
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(recipient);
        enrollment.setCourseOffering(courseOffering);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        enrollmentRepository.save(enrollment);
    }
}
