package io.github.huijingmen.softeng789.classroommonitoring.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureMetadata;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureResponse;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class FaceEnrollmentStorageService {
    private static final TypeReference<List<FaceEnrollmentCaptureMetadata>> CAPTURE_METADATA_LIST =
            new TypeReference<>() {
            };

    private final ObjectMapper objectMapper;
    private final Path storageRoot;

    public FaceEnrollmentStorageService(
            ObjectMapper objectMapper,
            @Value("${app.storage.face-enrollment-dir:../data/face-enrollment}") String storageRoot
    ) {
        this.objectMapper = objectMapper;
        this.storageRoot = Path.of(storageRoot);
    }

    public Path savePrimaryImage(UUID studentId, byte[] bytes) {
        try {
            Path studentDir = studentDirectory(studentId);
            Files.createDirectories(studentDir);
            Path imagePath = studentDir.resolve("enrollment.jpg");
            Files.write(imagePath, bytes);
            return imagePath;
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not save enrollment image.", ex);
        }
    }

    public Path saveCaptureImage(UUID studentId, String pose, byte[] bytes) {
        try {
            Path captureDir = studentDirectory(studentId).resolve("captures").normalize();
            Files.createDirectories(captureDir);
            Path imagePath = captureDir.resolve(safePose(pose) + ".jpg").normalize();
            Files.write(imagePath, bytes);
            return imagePath;
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not save enrollment capture.", ex);
        }
    }

    public List<FaceEnrollmentCaptureMetadata> readMetadata(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture metadata is required.");
        }
        try {
            return objectMapper.readValue(metadataJson, CAPTURE_METADATA_LIST);
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture metadata could not be read.", ex);
        }
    }

    public void writeMetadata(UUID studentId, List<FaceEnrollmentCaptureMetadata> metadata) {
        try {
            Files.createDirectories(studentDirectory(studentId));
            objectMapper.writeValue(metadataPath(studentId).toFile(), metadata);
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not save enrollment metadata.", ex);
        }
    }

    public Resource primaryPhoto(UUID studentId) {
        Path photo = studentDirectory(studentId).resolve("enrollment.jpg").normalize();
        if (!Files.isRegularFile(photo)) {
            throw new ResponseStatusException(NOT_FOUND, "Face enrollment photo not found.");
        }
        return new FileSystemResource(photo);
    }

    public Resource capturePhoto(UUID studentId, String pose) {
        Path photo = captureImagePath(studentId, safePose(pose));
        if (!Files.isRegularFile(photo)) {
            throw new ResponseStatusException(NOT_FOUND, "Face enrollment capture not found.");
        }
        return new FileSystemResource(photo);
    }

    public List<FaceEnrollmentCaptureResponse> listCaptures(UUID studentId) {
        Path metadataPath = metadataPath(studentId);
        if (!Files.isRegularFile(metadataPath)) {
            return List.of();
        }

        try {
            List<FaceEnrollmentCaptureMetadata> metadata =
                    objectMapper.readValue(metadataPath.toFile(), CAPTURE_METADATA_LIST);
            return metadata.stream()
                    .map(capture -> {
                        String pose = storedPose(capture.pose());
                        return new FaceEnrollmentCaptureResponse(
                                pose,
                                capture.label(),
                                capturePhotoUrl(studentId, pose),
                                capture.qualityScore(),
                                capture.poseScore(),
                                capture.capturedAt(),
                                Boolean.TRUE.equals(capture.optional())
                        );
                    })
                    .toList();
        } catch (IOException ex) {
            return List.of();
        }
    }

    public String publicImagePath(UUID studentId) {
        return "data/face-enrollment/" + studentId + "/enrollment.jpg";
    }

    public String photoUrl(UUID studentId) {
        return "/api/students/" + studentId + "/face-enrollment/photo";
    }

    public String capturePhotoUrl(UUID studentId, String pose) {
        return "/api/students/" + studentId + "/face-enrollment/captures/" + safePose(pose) + "/photo";
    }

    public String safePose(String pose) {
        if (pose == null || pose.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture pose is required.");
        }
        String safe = pose.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "_");
        if (safe.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture pose is invalid.");
        }
        return safe;
    }

    private Path metadataPath(UUID studentId) {
        return studentDirectory(studentId).resolve("captures.json").normalize();
    }

    private Path captureImagePath(UUID studentId, String pose) {
        return studentDirectory(studentId).resolve("captures").resolve(pose + ".jpg").normalize();
    }

    private Path studentDirectory(UUID studentId) {
        return storageRoot.resolve(studentId.toString()).normalize();
    }

    private String storedPose(String pose) {
        if (pose == null || pose.isBlank()) {
            return "unknown";
        }
        String safe = pose.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "_");
        return safe.isBlank() ? "unknown" : safe;
    }
}
