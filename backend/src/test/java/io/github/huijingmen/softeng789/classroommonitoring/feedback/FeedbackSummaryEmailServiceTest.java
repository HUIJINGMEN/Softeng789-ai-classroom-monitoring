package io.github.huijingmen.softeng789.classroommonitoring.feedback;

import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway;
import java.time.*;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:legacy-email;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
    "spring.datasource.driver-class-name=org.h2.Driver","spring.datasource.username=sa","spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"})
@ActiveProfiles("postgres")
class FeedbackSummaryEmailServiceTest {
    @Autowired FeedbackSummaryEmailService service;
    @Autowired FeedbackEmailRepository deliveries;
    @Autowired FeedbackSummaryRepository summaries;
    @Autowired TeacherRepository teachers;
    @Autowired StudentRepository students;
    @Autowired CourseRepository courses;
    @Autowired CourseOfferingRepository offerings;
    @MockitoBean ReportEmailGateway gateway;
    Teacher teacher;
    FeedbackSummary summary;
    @BeforeEach void setup() {
        String key = UUID.randomUUID().toString();
        teacher = new Teacher(); teacher.setName("Reviewer"); teacher.setStaffNumber(key); teacher.setEmail(key+"@staff.test");
        teacher.setRole("TEACHER"); teacher=teachers.saveAndFlush(teacher);
        var student=new Student(); student.setStudentNumber(key); student.setUniversityEmail(key+"@student.test");
        student.setFirstName("Email"); student.setLastName("Test");student.setCourse("TEST");student.setSeat("1");student.setProgramme("");student=students.saveAndFlush(student);
        var course=new Course();course.setCode(key);course.setName("Test");course=courses.saveAndFlush(course);
        var offering=new CourseOffering();offering.setCourse(course);offering.setOfferingCode(key);offering.setAcademicTerm("2026");offering.getTeachers().add(teacher);offering=offerings.saveAndFlush(offering);
        summary=new FeedbackSummary();summary.setStudent(student);summary.setCourseOffering(offering);summary.setCreatedBy(teacher);
        summary.setDateFrom(LocalDate.of(2026,1,1));summary.setDateTo(LocalDate.of(2026,10,1));summary.setSourceFeedbackCount(1);
        summary.setSourceFingerprint("a".repeat(64));summary.setProvider("test");summary.setSummary("Reviewed wording");
        summary.setStrengths("Recorded strength");summary.setNextSteps("Recorded next step");summary.setStatus("REVIEWED");
        summary.setReviewedBy(teacher);summary.setReviewedAt(Instant.parse("2026-10-01T00:00:00Z"));summary=summaries.saveAndFlush(summary);
    }
    @Test void repeatedRequestsSendTheReviewedSnapshotOnce() {
        when(gateway.send(any())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return new ReportEmailGateway.DeliveryResult("SENT", "Sent");
        });
        assertThat(service.deliver(summary.getId(),teacher.getId()).status()).isEqualTo("SENT");
        var student = students.findById(summary.getStudent().getId()).orElseThrow();
        student.setUniversityEmail(UUID.randomUUID()+"@changed.test");students.saveAndFlush(student);
        assertThat(service.deliver(summary.getId(),teacher.getId()).status()).isEqualTo("SENT");
        verify(gateway,times(1)).send(org.mockito.ArgumentMatchers.argThat(message->message.summary().equals("Reviewed wording")));
        assertThat(summaries.findById(summary.getId()).orElseThrow().getEmailedAt()).isNotNull();
    }
    @Test void uncertainSendDoesNotReplayAndDoesNotClaimSuccess() {
        when(gateway.send(any())).thenThrow(new IllegalStateException("SMTP accepted then timed out"));
        assertThat(service.deliver(summary.getId(),teacher.getId()).status()).isEqualTo("UNKNOWN");
        assertThat(service.deliver(summary.getId(),teacher.getId()).status()).isEqualTo("UNKNOWN");
        verify(gateway,times(1)).send(any());
        assertThat(summaries.findById(summary.getId()).orElseThrow().getEmailedAt()).isNull();
    }
    @Test void concurrentRequestsCannotSendWhileAnotherDeliveryIsInFlight() throws Exception {
        var sending=new CountDownLatch(1);var release=new CountDownLatch(1);
        when(gateway.send(any())).thenAnswer(invocation->{sending.countDown();assertThat(release.await(10,TimeUnit.SECONDS)).isTrue();return new ReportEmailGateway.DeliveryResult("SENT","Sent");});
        try(var executor=Executors.newFixedThreadPool(2)) {
            var first=executor.submit(()->service.deliver(summary.getId(),teacher.getId()));
            assertThat(sending.await(10,TimeUnit.SECONDS)).isTrue();
            var repeated=executor.submit(()->service.deliver(summary.getId(),teacher.getId()));
            try { assertThat(repeated.get(5,TimeUnit.SECONDS).status()).isEqualTo("UNKNOWN"); }
            finally { release.countDown(); }
            assertThat(first.get(10,TimeUnit.SECONDS).status()).isEqualTo("SENT");
        }
        verify(gateway,times(1)).send(any());
    }
    @Test void historicalSentRevisionIsNotResentButAnExplicitNewReviewCanBeSent() {
        summary.setEmailedAt(summary.getReviewedAt().plusSeconds(1));summaries.saveAndFlush(summary);
        assertThat(service.deliver(summary.getId(),teacher.getId()).status()).isEqualTo("SENT");verifyNoInteractions(gateway);
        summary.setReviewedAt(summary.getReviewedAt().plusSeconds(2));summary.setSummary("New reviewed wording");summaries.saveAndFlush(summary);
        when(gateway.send(any())).thenReturn(new ReportEmailGateway.DeliveryResult("DEMO","Demo only"));
        assertThat(service.deliver(summary.getId(),teacher.getId()).status()).isEqualTo("DEMO");
        assertThat(service.deliver(summary.getId(),teacher.getId()).status()).isEqualTo("DEMO");verify(gateway,times(1)).send(any());
    }
}
