package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.FeedbackSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.GenerateFeedbackSummaryRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.GenerateReportInsightRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ReportInsightResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentRecognitionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.FeedbackSummaryRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ProgressReportRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:ai-gateway-transaction-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
@Import(AiGatewayTransactionBoundaryTest.GatewayConfiguration.class)
class AiGatewayTransactionBoundaryTest {
    private static final ZoneId REPORT_ZONE = ZoneId.of("Pacific/Auckland");

    @Autowired
    private FeedbackSummaryService feedbackSummaryService;

    @Autowired
    private ProgressReportService progressReportService;

    @Autowired
    private StudentRecognitionService studentRecognitionService;

    @Autowired
    private RecordingFeedbackSummaryGateway summaryGateway;

    @Autowired
    private RecordingStudentRecognitionGateway recognitionGateway;

    @Autowired
    private FeedbackSummaryRepository feedbackSummaryRepository;

    @Autowired
    private ProgressReportRepository progressReportRepository;

    @Autowired
    private CourseEnrollmentRepository enrollmentRepository;

    @Autowired
    private CourseOfferingRepository offeringRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @BeforeEach
    void resetDatabaseAndGateways() {
        feedbackSummaryRepository.deleteAll();
        progressReportRepository.deleteAll();
        enrollmentRepository.deleteAll();
        offeringRepository.deleteAll();
        courseRepository.deleteAll();
        studentRepository.deleteAll();
        teacherRepository.deleteAll();
        summaryGateway.reset();
        recognitionGateway.reset();
    }

    @Test
    void summaryGenerationCallsTheAiGatewayAfterTheDatabaseTransactionCloses() {
        Teacher teacher = saveTeacher();
        CourseOffering offering = saveOffering(teacher);
        Student student = saveStudent();
        enrol(student, offering);
        progressReportService.createReport(
                student.getId(), offering.getId(), "Clear progress in the project work.", null, teacher.getId());
        LocalDate today = LocalDate.now(REPORT_ZONE);

        AtomicReference<FeedbackSummaryResponse> generated = new AtomicReference<>();
        AtomicReference<ReportInsightResponse> insight = new AtomicReference<>();
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            generated.set(feedbackSummaryService.generate(
                    new GenerateFeedbackSummaryRequest(
                            student.getId(), offering.getId(), today.minusDays(1), today.plusDays(1)),
                    teacher.getId()));
            insight.set(feedbackSummaryService.generateInsight(
                    new GenerateReportInsightRequest(
                            "CLASS", offering.getId(), today.minusDays(1), today.plusDays(1)),
                    teacher.getId()));
        });

        assertThat(generated.get()).isNotNull();
        assertThat(generated.get().provider()).isEqualTo("TEST");
        assertThat(insight.get()).isNotNull();
        assertThat(insight.get().provider()).isEqualTo("TEST");
        assertThat(summaryGateway.callCount()).isEqualTo(2);
        assertThat(summaryGateway.transactionObserved()).isFalse();
    }

    @Test
    void studentRecognitionCallsTheAiGatewayWithDetachedCandidateData() {
        Teacher teacher = saveTeacher();
        CourseOffering offering = saveOffering(teacher);
        Student student = saveStudent();
        enrol(student, offering);
        MockMultipartFile photo = new MockMultipartFile(
                "photo", "capture.png", "image/png", Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="));

        AtomicReference<StudentRecognitionResponse> result = new AtomicReference<>();
        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                result.set(studentRecognitionService.recognize(offering.getId(), photo, teacher.getId())));

        assertThat(result.get()).isNotNull();
        assertThat(result.get().studentId()).isEqualTo(student.getId());
        assertThat(result.get().mode()).isEqualTo("TEST");
        assertThat(recognitionGateway.transactionObserved()).isFalse();
    }

    private Teacher saveTeacher() {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-AI-BOUNDARY");
        teacher.setEmail("ai-boundary@auckland.ac.nz");
        teacher.setName("AI Boundary Teacher");
        teacher.setRole("TEACHER");
        teacher.setStatus("ACTIVE");
        return teacherRepository.save(teacher);
    }

    private CourseOffering saveOffering(Teacher teacher) {
        Course course = new Course();
        course.setCode("SOFTENG 789");
        course.setName("Research Project");
        courseRepository.save(course);

        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode("SOFTENG-789-2026");
        offering.setAcademicTerm("2026 Teaching Year");
        offering.getTeachers().add(teacher);
        return offeringRepository.save(offering);
    }

    private Student saveStudent() {
        Student student = new Student();
        student.setStudentNumber("AI-BOUNDARY-1");
        student.setUniversityEmail("ai-boundary-1@aucklanduni.ac.nz");
        student.setFirstName("Boundary");
        student.setLastName("Student");
        student.setCourse("SOFTENG 789");
        student.setSeat("Unassigned");
        student.setProgramme("Engineering");
        student.setConsentGiven(true);
        return studentRepository.save(student);
    }

    private void enrol(Student student, CourseOffering offering) {
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourseOffering(offering);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        enrollmentRepository.save(enrollment);
    }

    @TestConfiguration
    static class GatewayConfiguration {
        @Bean
        @Primary
        RecordingFeedbackSummaryGateway recordingFeedbackSummaryGateway() {
            return new RecordingFeedbackSummaryGateway();
        }

        @Bean
        @Primary
        RecordingStudentRecognitionGateway recordingStudentRecognitionGateway() {
            return new RecordingStudentRecognitionGateway();
        }
    }

    static class RecordingFeedbackSummaryGateway implements FeedbackSummaryGateway {
        private final AtomicBoolean transactionObserved = new AtomicBoolean();
        private int callCount;

        @Override
        public GeneratedSummary summarize(
                String studentName,
                String classLabel,
                LocalDate dateFrom,
                LocalDate dateTo,
                List<String> feedback
        ) {
            transactionObserved.compareAndSet(
                    false, TransactionSynchronizationManager.isActualTransactionActive());
            callCount += 1;
            return new GeneratedSummary(
                    String.join(" ", feedback), "Consistent progress.", "Keep going.", "TEST");
        }

        void reset() {
            transactionObserved.set(false);
            callCount = 0;
        }

        boolean transactionObserved() {
            return transactionObserved.get();
        }

        int callCount() {
            return callCount;
        }
    }

    static class RecordingStudentRecognitionGateway implements StudentRecognitionGateway {
        private final AtomicBoolean transactionObserved = new AtomicBoolean();

        @Override
        public RecognitionMatch recognize(byte[] photo, List<RecognitionCandidate> candidates) {
            transactionObserved.set(TransactionSynchronizationManager.isActualTransactionActive());
            return new RecognitionMatch(candidates.getFirst().studentId(), 0.99, "TEST");
        }

        void reset() {
            transactionObserved.set(false);
        }

        boolean transactionObserved() {
            return transactionObserved.get();
        }
    }
}
