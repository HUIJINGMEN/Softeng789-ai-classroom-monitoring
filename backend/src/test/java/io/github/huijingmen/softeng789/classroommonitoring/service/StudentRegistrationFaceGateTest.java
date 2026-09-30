package io.github.huijingmen.softeng789.classroommonitoring.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureMetadata;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RegisterStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.StudentLevel;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.FaceEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
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
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:student-registration-face-gate;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.storage.face-enrollment-dir=target/test-student-registration-face-gate"
})
@ActiveProfiles("postgres")
@Import(StudentRegistrationFaceGateTest.GatewayConfiguration.class)
class StudentRegistrationFaceGateTest {
    private static final Path STORAGE_ROOT = Path.of("target/test-student-registration-face-gate");
    private static final byte[] SAMPLE_IMAGE = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
    private static final List<String> POSES = List.of(
            "front", "slight_left", "left", "slight_right", "right", "chin_up", "chin_down");

    @Autowired
    private AuthService authService;
    @Autowired
    private StudentRepository studentRepository;
    @Autowired
    private CourseRepository courseRepository;
    @Autowired
    private CourseOfferingRepository courseOfferingRepository;
    @Autowired
    private CourseEnrollmentRepository courseEnrollmentRepository;
    @Autowired
    private FaceEnrollmentRepository faceEnrollmentRepository;
    @Autowired
    private ControllableFaceEnrollmentGateway gateway;
    @Autowired
    private ObjectMapper objectMapper;

    private CourseOffering offering;

    @BeforeEach
    void setUp() throws IOException {
        faceEnrollmentRepository.deleteAll();
        courseEnrollmentRepository.deleteAll();
        studentRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
        gateway.reset();
        deleteStorage();

        Course course = new Course();
        course.setCode("SOFTENG 789");
        course.setName("Research Project");
        course = courseRepository.save(course);
        offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode("SOFTENG-789-2026");
        offering.setAcademicTerm("2026 Teaching Year");
        offering.setStatus("ACTIVE");
        offering = courseOfferingRepository.save(offering);
    }

    @AfterAll
    static void cleanUpStorage() throws IOException {
        deleteStorage();
    }

    @Test
    void rejectedFaceVerificationCreatesNoRegistrationRequest() throws Exception {
        gateway.reject();

        assertThatThrownBy(() -> authService.registerStudent(
                request("FACE-REJECTED", "face-rejected@aucklanduni.ac.nz"),
                captureMetadataJson(),
                captureImages()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Face verification did not pass");

        assertNoRegistrationWasCreated("FACE-REJECTED");
    }

    @Test
    void mismatchedProviderIdentityCreatesNoRegistrationRequest() throws Exception {
        gateway.returnMismatchedIdentity();

        assertThatThrownBy(() -> authService.registerStudent(
                request("FACE-MISMATCH", "face-mismatch@aucklanduni.ac.nz"),
                captureMetadataJson(),
                captureImages()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("mismatched result");

        assertNoRegistrationWasCreated("FACE-MISMATCH");
    }

    @Test
    void unavailableProviderCreatesNoRegistrationRequest() throws Exception {
        gateway.becomeUnavailable();

        assertThatThrownBy(() -> authService.registerStudent(
                request("FACE-UNAVAILABLE", "face-unavailable@aucklanduni.ac.nz"),
                captureMetadataJson(),
                captureImages()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("temporarily unavailable");

        assertNoRegistrationWasCreated("FACE-UNAVAILABLE");
    }

    @Test
    void verifiedFaceCreatesPendingRegistrationWithVerifiedEnrollment() throws Exception {
        authService.registerStudent(
                request("FACE-VERIFIED", "face-verified@aucklanduni.ac.nz"),
                captureMetadataJson(),
                captureImages());

        Student student = studentRepository.findByStudentNumberIgnoreCase("FACE-VERIFIED").orElseThrow();
        assertThat(gateway.transactionObserved()).isFalse();
        assertThat(student.getApprovalStatus()).isEqualTo("PENDING");
        assertThat(student.getFaceEnrollmentStatus()).isEqualTo(FaceEnrollmentStatus.VERIFIED);
        assertThat(courseEnrollmentRepository
                .findByStudent_IdAndStatus(student.getId(), CourseEnrollment.EnrollmentStatus.PENDING))
                .hasSize(1);
        assertThat(faceEnrollmentRepository.findByStudent_Id(student.getId()).orElseThrow().getStatus())
                .isEqualTo(FaceEnrollmentStatus.VERIFIED);
    }

    private RegisterStudentRequest request(String studentNumber, String email) {
        return new RegisterStudentRequest(
                studentNumber,
                email,
                "Verified Student",
                "SOFTENG 789",
                List.of(offering.getId()),
                "secure-password",
                true,
                StudentLevel.LEVEL_4
        );
    }

    private void assertNoRegistrationWasCreated(String studentNumber) {
        assertThat(gateway.transactionObserved()).isFalse();
        assertThat(studentRepository.findByStudentNumberIgnoreCase(studentNumber)).isEmpty();
        assertThat(courseEnrollmentRepository.count()).isZero();
        assertThat(faceEnrollmentRepository.count()).isZero();
    }

    private String captureMetadataJson() throws Exception {
        List<FaceEnrollmentCaptureMetadata> metadata = POSES.stream()
                .map(pose -> new FaceEnrollmentCaptureMetadata(
                        pose, pose, 0.9, 0.9, "2026-09-29T10:00:00Z", false))
                .toList();
        return objectMapper.writeValueAsString(metadata);
    }

    private List<MultipartFile> captureImages() {
        return POSES.stream()
                .map(pose -> (MultipartFile) new MockMultipartFile(
                        "images", pose + ".png", "image/png", SAMPLE_IMAGE))
                .toList();
    }

    private static void deleteStorage() throws IOException {
        if (!Files.exists(STORAGE_ROOT)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(STORAGE_ROOT)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        }
    }

    @TestConfiguration
    static class GatewayConfiguration {
        @Bean
        @Primary
        ControllableFaceEnrollmentGateway controllableFaceEnrollmentGateway() {
            return new ControllableFaceEnrollmentGateway();
        }
    }

    static class ControllableFaceEnrollmentGateway implements FaceEnrollmentGateway {
        private final AtomicBoolean transactionObserved = new AtomicBoolean();
        private ResponseMode mode = ResponseMode.VERIFIED;

        @Override
        public AiFaceEnrollmentResponse verifyCaptures(String subjectId, List<FaceCapture> captures) {
            transactionObserved.set(TransactionSynchronizationManager.isActualTransactionActive());
            if (mode == ResponseMode.MISMATCHED_IDENTITY) {
                return new AiFaceEnrollmentResponse(
                        "another-student", true, true, "VERIFIED", "Wrong subject.", "TEST");
            }
            if (mode == ResponseMode.UNAVAILABLE) {
                return new AiFaceEnrollmentResponse(
                        subjectId, false, false, "UNAVAILABLE",
                        "Face verification is temporarily unavailable.", "TEST");
            }
            boolean accepted = mode == ResponseMode.VERIFIED;
            return new AiFaceEnrollmentResponse(
                    subjectId,
                    accepted,
                    accepted,
                    accepted ? "VERIFIED" : "FAILED",
                    accepted ? "Verified for testing." : "Face verification did not pass.",
                    "TEST"
            );
        }

        void reject() {
            mode = ResponseMode.REJECTED;
        }

        void returnMismatchedIdentity() {
            mode = ResponseMode.MISMATCHED_IDENTITY;
        }

        void becomeUnavailable() {
            mode = ResponseMode.UNAVAILABLE;
        }

        void reset() {
            mode = ResponseMode.VERIFIED;
            transactionObserved.set(false);
        }

        boolean transactionObserved() {
            return transactionObserved.get();
        }

        private enum ResponseMode {
            VERIFIED,
            REJECTED,
            MISMATCHED_IDENTITY,
            UNAVAILABLE
        }
    }
}
