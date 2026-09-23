package io.github.huijingmen.softeng789.classroommonitoring.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureMetadata;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FaceEnrollmentStorageServiceTest {
    @TempDir
    private Path storageRoot;

    private FaceEnrollmentStorageService storageService;

    @BeforeEach
    void setUp() {
        ProtectedMediaService protectedMediaService = mock(ProtectedMediaService.class);
        when(protectedMediaService.faceCaptureUrl(any(UUID.class), anyString()))
                .thenAnswer(invocation -> "/capture/" + invocation.getArgument(1));
        storageService = new FaceEnrollmentStorageService(
                new ObjectMapper(), protectedMediaService, storageRoot.toString());
    }

    @Test
    void rollbackRestoresTheCompletePreviousEnrollmentDirectory() throws Exception {
        UUID studentId = UUID.randomUUID();
        storageService.savePrimaryImage(studentId, bytes("old-primary"));
        storageService.saveCaptureImage(studentId, "front", bytes("old-front"));
        storageService.writeMetadata(studentId, List.of(metadata("front", "Old front")));

        FaceEnrollmentStorageService.StorageUpdate update = storageService.beginUpdate(studentId);
        storageService.savePrimaryImage(studentId, bytes("new-primary"));
        storageService.saveCaptureImage(studentId, "front", bytes("new-front"));
        storageService.saveCaptureImage(studentId, "left", bytes("new-left"));
        storageService.writeMetadata(studentId, List.of(metadata("left", "New left")));

        update.rollback();

        assertThat(storageService.primaryPhoto(studentId).getContentAsByteArray())
                .isEqualTo(bytes("old-primary"));
        assertThat(storageService.capturePhoto(studentId, "front").getContentAsByteArray())
                .isEqualTo(bytes("old-front"));
        assertThat(storageService.listCaptures(studentId))
                .extracting(response -> response.label())
                .containsExactly("Old front");
        assertThat(Files.exists(storageRoot.resolve(studentId.toString()).resolve("captures/left.jpg")))
                .isFalse();
    }

    @Test
    void rollbackRemovesFilesCreatedForANewEnrollment() {
        UUID studentId = UUID.randomUUID();

        FaceEnrollmentStorageService.StorageUpdate update = storageService.beginUpdate(studentId);
        storageService.savePrimaryImage(studentId, bytes("new-primary"));
        update.rollback();

        assertThat(Files.exists(storageRoot.resolve(studentId.toString()))).isFalse();
    }

    @Test
    void commitKeepsTheReplacementFiles() throws Exception {
        UUID studentId = UUID.randomUUID();
        storageService.savePrimaryImage(studentId, bytes("old-primary"));

        FaceEnrollmentStorageService.StorageUpdate update = storageService.beginUpdate(studentId);
        storageService.savePrimaryImage(studentId, bytes("new-primary"));
        update.commit();

        assertThat(storageService.primaryPhoto(studentId).getContentAsByteArray())
                .isEqualTo(bytes("new-primary"));
    }

    private FaceEnrollmentCaptureMetadata metadata(String pose, String label) {
        return new FaceEnrollmentCaptureMetadata(pose, label, 0.9, 0.8, "2026-09-24T10:00:00Z", false);
    }

    private byte[] bytes(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }
}
