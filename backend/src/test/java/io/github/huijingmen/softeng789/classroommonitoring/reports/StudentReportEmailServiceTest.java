package io.github.huijingmen.softeng789.classroommonitoring.reports;

import static io.github.huijingmen.softeng789.classroommonitoring.auth.BrowserTestSession.browserSession;

import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:student-report-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
        "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
@AutoConfigureMockMvc
class StudentReportEmailServiceTest {
    @Autowired private StudentReportService service;
    @Autowired private StudentReportEmailRepository deliveries;
    @Autowired private TeacherRepository teachers;
    @Autowired private StudentRepository students;
    @Autowired private CourseRepository courses;
    @Autowired private CourseOfferingRepository offerings;
    @Autowired private CourseEnrollmentRepository enrolments;
    @Autowired private MockMvc mvc;
    @Autowired private SessionAuthService auth;
    @MockitoBean private ReportNarrativeGateway ai;
    @MockitoBean private ReportEmailGateway email;
    private Teacher teacher;
    private View reviewed;

    @BeforeEach void setup() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        teacher = new Teacher(); teacher.setStaffNumber("E-" + suffix); teacher.setEmail(suffix + "@staff.test");
        teacher.setName("Email Reviewer"); teacher.setRole("TEACHER"); teacher = teachers.save(teacher);
        var student = new Student(); student.setStudentNumber("E-" + suffix); student.setUniversityEmail(suffix + "@student.test");
        student.setFirstName("Email"); student.setLastName("Student"); student.setCourse("EMAIL"); student.setSeat("A1");
        student.setProgramme("Engineering");
        student = students.save(student);
        var course = new Course(); course.setCode("E" + suffix); course.setName("Email Test"); course = courses.save(course);
        var offering = new CourseOffering(); offering.setCourse(course); offering.setOfferingCode("E" + suffix);
        offering.setAcademicTerm("2026"); offering.getTeachers().add(teacher); offering = offerings.save(offering);
        var enrolment = new CourseEnrollment(); enrolment.setStudent(student); enrolment.setCourseOffering(offering);
        enrolment.setEnrolledAt(Instant.parse("2026-01-01T00:00:00Z")); enrolments.save(enrolment);
        reviewed = service.prepare(new Scope(student.getId(), LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31), List.of(offering.getId())), teacher.getId());
        for (Section section : reviewed.document().sections()) reviewed = service.save(reviewed.id(), section.topic(),
                new Edit(reviewed.version(), "Reviewed " + section.title(), true), teacher.getId());
        when(email.send(any())).thenReturn(new ReportEmailGateway.DeliveryResult("SENT", "Sent in test"));
    }

    @Test void repeatedRequestsAndReopenedWindowsReplayTheDurableReceipt() {
        var first = service.email(reviewed.id(), reviewed.version(), teacher.getId());
        var retry = service.email(reviewed.id(), reviewed.version(), teacher.getId());
        assertThat(retry).isEqualTo(first);
        verify(email, times(1)).send(any());
        assertThat(deliveries.findByReportIdAndReportVersion(reviewed.id(), reviewed.version())).isPresent();
        service.save(reviewed.id(), Topic.ATTENDANCE, new Edit(reviewed.version(), "Changed later", false), teacher.getId());
        assertThat(service.email(reviewed.id(), reviewed.version(), teacher.getId())).isEqualTo(first);
        verify(email, times(1)).send(any());
    }

    @Test void changedServerRevisionCannotBeEmailedFromAnOldPreview() {
        service.save(reviewed.id(), Topic.ATTENDANCE, new Edit(reviewed.version(), "Different approved content", true), teacher.getId());
        assertThatThrownBy(() -> service.email(reviewed.id(), reviewed.version(), teacher.getId()))
                .hasMessageContaining("Reopen the preview");
        verifyNoInteractions(email);
        assertThat(deliveries.findByReportIdAndReportVersion(reviewed.id(), reviewed.version())).isEmpty();
    }

    @Test void providerTimeoutNeverTriggersAnAutomaticSecondSend() {
        when(email.send(any())).thenThrow(new IllegalStateException("SMTP acknowledgement lost"));
        var uncertain = service.email(reviewed.id(), reviewed.version(), teacher.getId());
        assertThat(uncertain.status()).isEqualTo("UNKNOWN");
        assertThat(uncertain.message()).contains("Check with the recipient", "PDF and portal");
        assertThat(service.email(reviewed.id(), reviewed.version(), teacher.getId())).isEqualTo(uncertain);
        verify(email, times(1)).send(any());
    }

    @Test void interruptedWorkerLeavesANoResendBarrier() {
        deliveries.saveAndFlush(new StudentReportEmailDelivery(reviewed.id(), reviewed.version()));
        assertThat(service.email(reviewed.id(), reviewed.version(), teacher.getId()).status()).isEqualTo("UNKNOWN");
        verifyNoInteractions(email);
    }

    @Test void publicationUsesItsNewRevisionAndStillSendsOnlyOnce() {
        var published = service.publish(reviewed.id(), reviewed.version(), teacher.getId());
        assertThat(published.version()).isGreaterThan(reviewed.version());
        assertThatThrownBy(() -> service.email(published.id(), reviewed.version(), teacher.getId())).hasMessageContaining("Reopen the preview");
        assertThat(service.email(published.id(), published.version(), teacher.getId()).status()).isEqualTo("SENT");
        service.email(published.id(), published.version(), teacher.getId());
        verify(email, times(1)).send(any());
    }

    @Test void concurrentRequestsCannotBothReachSmtp() throws Exception {
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        when(email.send(any())).thenAnswer(invocation -> {
            entered.countDown();
            if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Test timed out");
            return new ReportEmailGateway.DeliveryResult("SENT", "Sent once");
        });
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> service.email(reviewed.id(), reviewed.version(), teacher.getId()));
            try {
                assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
                assertThat(service.email(reviewed.id(), reviewed.version(), teacher.getId()).status()).isEqualTo("UNKNOWN");
            } finally { release.countDown(); }
            assertThat(first.get(5, TimeUnit.SECONDS).status()).isEqualTo("SENT");
        }
        verify(email, times(1)).send(any());
    }

    @Test void emailApiRequiresVersionAndChecksAccessEvenWhenReplaying() throws Exception {
        String token = "Bearer " + auth.issueToken("TEACHER", teacher.getId(), teacher.getName(), teacher.getEmail(), null).token();
        mvc.perform(post("/api/student-reports/" + reviewed.id() + "/email").with(browserSession(token))
                .contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
        service.email(reviewed.id(), reviewed.version(), teacher.getId());
        var outsider = new Teacher(); outsider.setStaffNumber(UUID.randomUUID().toString());
        outsider.setEmail(UUID.randomUUID() + "@staff.test"); outsider.setName("Outsider"); outsider.setRole("TEACHER");
        UUID outsiderId = teachers.save(outsider).getId();
        assertThatThrownBy(() -> service.email(reviewed.id(), reviewed.version(), outsiderId)).hasMessageContaining("403");
        verify(email, times(1)).send(any());
    }
}
