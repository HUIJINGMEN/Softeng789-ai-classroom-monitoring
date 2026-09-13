package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassFeedbackRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.GenerateReportInsightRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassFeedbackRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:class-feedback-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class ClassFeedbackServiceTest {
    @Autowired
    private ClassFeedbackService classFeedbackService;

    @Autowired
    private ClassFeedbackRepository classFeedbackRepository;

    @Autowired
    private FeedbackSummaryService feedbackSummaryService;

    @Autowired
    private CourseOfferingRepository courseOfferingRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @BeforeEach
    void cleanDatabase() {
        classFeedbackRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
        teacherRepository.deleteAll();
    }

    @Test
    void teacherCanCreateAndReadFeedbackForTheirOwnClass() {
        Teacher teacher = teacher("UOA-CLASS-OWNER", "class-owner@auckland.ac.nz", "Class Owner", "TEACHER");
        CourseOffering offering = offering("SOFTENG 789", teacher);

        var created = classFeedbackService.create(
                new CreateClassFeedbackRequest(offering.getId(), "The class handled the lab discussion well."),
                teacher.getId());

        assertThat(created.classLabel()).isEqualTo("SOFTENG 789 · 2026 Teaching Year");
        assertThat(created.comment()).isEqualTo("The class handled the lab discussion well.");
        assertThat(classFeedbackService.listForClass(offering.getId(), teacher.getId()))
                .singleElement()
                .satisfies(item -> assertThat(item.id()).isEqualTo(created.id()));
    }

    @Test
    void teacherCannotCreateOrReadFeedbackOutsideTheirClasses() {
        Teacher owner = teacher("UOA-CLASS-A", "class-a@auckland.ac.nz", "Teacher A", "TEACHER");
        Teacher outsider = teacher("UOA-CLASS-B", "class-b@auckland.ac.nz", "Teacher B", "TEACHER");
        CourseOffering offering = offering("COMPSCI 335", owner);

        assertThatThrownBy(() -> classFeedbackService.create(
                new CreateClassFeedbackRequest(offering.getId(), "Not allowed."), outsider.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("your own classes");
        assertThatThrownBy(() -> classFeedbackService.listForClass(offering.getId(), outsider.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("your own classes");
    }

    @Test
    void adminCanCreateFeedbackForAnyClass() {
        Teacher owner = teacher("UOA-CLASS-C", "class-c@auckland.ac.nz", "Teacher C", "TEACHER");
        Teacher admin = teacher("UOA-CLASS-ADMIN", "class-admin@auckland.ac.nz", "Class Admin", "ADMIN");
        CourseOffering offering = offering("COMPSCI 730", owner);

        var created = classFeedbackService.create(
                new CreateClassFeedbackRequest(offering.getId(), "Institution-level class note."), admin.getId());

        assertThat(created.teacherName()).isEqualTo("Class Admin");
        assertThat(classFeedbackService.listForClass(offering.getId(), admin.getId())).hasSize(1);
    }

    @Test
    void classFeedbackContributesToTheClassAiSummary() {
        Teacher teacher = teacher("UOA-CLASS-SUMMARY", "class-summary@auckland.ac.nz", "Summary Teacher", "TEACHER");
        CourseOffering offering = offering("SOFTENG 701", teacher);
        classFeedbackService.create(
                new CreateClassFeedbackRequest(offering.getId(), "Good progress across the class discussion."),
                teacher.getId());
        LocalDate today = LocalDate.now(ZoneId.of("Pacific/Auckland"));

        var insight = feedbackSummaryService.generateInsight(
                new GenerateReportInsightRequest("CLASS", offering.getId(), today.minusDays(1), today.plusDays(1)),
                teacher.getId());

        assertThat(insight.sourceFeedbackCount()).isEqualTo(1);
        assertThat(insight.summary()).contains("Good progress across the class discussion.");
    }

    private Teacher teacher(String staffNumber, String email, String name, String role) {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber(staffNumber);
        teacher.setEmail(email);
        teacher.setName(name);
        teacher.setRole(role);
        return teacherRepository.save(teacher);
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
        offering.getTeachers().add(teacher);
        return courseOfferingRepository.save(offering);
    }
}
