package io.github.huijingmen.softeng789.classroommonitoring.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFaceEnrollmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureMetadata;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.FaceEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:face-enrollment-transaction-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.storage.face-enrollment-dir=target/test-face-enrollment-transaction"
})
@ActiveProfiles("postgres")
@Import(FaceEnrollmentTransactionTest.GatewayConfiguration.class)
class FaceEnrollmentTransactionTest {
    private static final Path STORAGE_ROOT = Path.of("target/test-face-enrollment-transaction");
    private static final byte[] SAMPLE_IMAGE = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
    private static final List<String> POSES = List.of(
            "front", "slight_left", "left", "slight_right", "right", "chin_up", "chin_down");

    @Autowired
    private FaceEnrollmentService faceEnrollmentService;

    @Autowired
    private FaceEnrollmentStorageService storageService;

    @Autowired
    private FaceEnrollmentRepository faceEnrollmentRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private RecordingFaceEnrollmentGateway faceEnrollmentGateway;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void reset() throws IOException {
        faceEnrollmentRepository.deleteAll();
        studentRepository.deleteAll();
        faceEnrollmentGateway.reset();
        deleteStorage();
    }

    @AfterAll
    static void cleanUpStorage() throws IOException {
        deleteStorage();
    }

    @Test
    void captureFilesAreRemovedWhenTheSurroundingRegistrationTransactionRollsBack() throws Exception {
        String metadataJson = captureMetadataJson();
        UUID studentId = Objects.requireNonNull(new TransactionTemplate(transactionManager).execute(status -> {
            Student student = studentRepository.save(newStudent("rollback"));
            faceEnrollmentService.enrolFaceCaptures(
                    student.getId(), metadataJson, captureImages());
            assertThat(storageService.primaryPhoto(student.getId()).exists()).isTrue();
            status.setRollbackOnly();
            return student.getId();
        }));

        assertThat(studentRepository.findById(studentId)).isEmpty();
        assertThat(faceEnrollmentRepository.findByStudent_Id(studentId)).isEmpty();
        assertThatThrownBy(() -> storageService.primaryPhoto(studentId))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void singlePhotoAiCallRunsOutsideTheCallersDatabaseTransaction() {
        Student student = studentRepository.save(newStudent("gateway"));
        MockMultipartFile image = new MockMultipartFile(
                "image", "front.png", "image/png", SAMPLE_IMAGE);

        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                faceEnrollmentService.enrolFace(student.getId(), image));

        assertThat(faceEnrollmentGateway.transactionObserved()).isFalse();
        assertThat(faceEnrollmentRepository.findByStudent_Id(student.getId())).isPresent();
    }

    private Student newStudent(String suffix) {
        Student student = new Student();
        student.setStudentNumber("FACE-" + suffix);
        student.setUniversityEmail("face-" + suffix + "@aucklanduni.ac.nz");
        student.setFirstName("Face");
        student.setLastName("Student");
        student.setCourse("SOFTENG 789");
        student.setSeat("Unassigned");
        student.setProgramme("Engineering");
        student.setConsentGiven(true);
        return student;
    }

    private String captureMetadataJson() throws Exception {
        List<FaceEnrollmentCaptureMetadata> metadata = POSES.stream()
                .map(pose -> new FaceEnrollmentCaptureMetadata(
                        pose, pose, 0.9, 0.9, "2026-09-24T10:00:00Z", false))
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
        RecordingFaceEnrollmentGateway recordingFaceEnrollmentGateway() {
            return new RecordingFaceEnrollmentGateway();
        }
    }

    static class RecordingFaceEnrollmentGateway implements FaceEnrollmentGateway {
        private final AtomicBoolean transactionObserved = new AtomicBoolean();

        @Override
        public AiFaceEnrollmentResponse validateFaceEnrollmentImage(UUID studentId, Path imagePath) {
            transactionObserved.set(TransactionSynchronizationManager.isActualTransactionActive());
            return new AiFaceEnrollmentResponse(
                    studentId.toString(), true, true, "PHOTO_CAPTURED", "Accepted for testing.");
        }

        void reset() {
            transactionObserved.set(false);
        }

        boolean transactionObserved() {
            return transactionObserved.get();
        }
    }
}
