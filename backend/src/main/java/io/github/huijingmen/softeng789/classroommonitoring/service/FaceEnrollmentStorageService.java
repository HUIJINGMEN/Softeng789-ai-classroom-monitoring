package io.github.huijingmen.softeng789.classroommonitoring.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureMetadata;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureResponse;
import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class FaceEnrollmentStorageService {
    private static final Logger LOGGER = LoggerFactory.getLogger(FaceEnrollmentStorageService.class);
    private static final TypeReference<List<FaceEnrollmentCaptureMetadata>> CAPTURE_METADATA_LIST =
            new TypeReference<>() {
            };

    private final ObjectMapper objectMapper;
    private final Path storageRoot;
    private final ProtectedMediaService protectedMediaService;
    private final ConcurrentHashMap<UUID, ReentrantLock> studentLocks = new ConcurrentHashMap<>();

    public FaceEnrollmentStorageService(
            ObjectMapper objectMapper,
            ProtectedMediaService protectedMediaService,
            @Value("${app.storage.face-enrollment-dir:../data/face-enrollment}") String storageRoot
    ) {
        this.objectMapper = objectMapper;
        this.protectedMediaService = protectedMediaService;
        this.storageRoot = Path.of(storageRoot);
    }

    public Path savePrimaryImage(UUID studentId, byte[] bytes) {
        try {
            Path studentDir = studentDirectory(studentId);
            Files.createDirectories(studentDir);
            Path imagePath = studentDir.resolve("enrollment.jpg");
            writeAtomically(imagePath, bytes);
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
            writeAtomically(imagePath, bytes);
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
            Path studentDir = studentDirectory(studentId);
            Files.createDirectories(studentDir);
            writeAtomically(metadataPath(studentId), objectMapper.writeValueAsBytes(metadata));
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not save enrollment metadata.", ex);
        }
    }

    /**
     * Starts a recoverable update for one student's protected face files. Updates for the same
     * student are serialised, and the returned handle can restore the exact previous directory if
     * the surrounding database transaction fails. Callers must always finish the handle through
     * either {@link StorageUpdate#commit()} or {@link StorageUpdate#rollback()}.
     */
    @SuppressWarnings("java:S2222") // The returned handle owns the lock until commit/rollback.
    public StorageUpdate beginUpdate(UUID studentId) {
        ReentrantLock lock = studentLocks.computeIfAbsent(studentId, ignored -> new ReentrantLock());
        lock.lock();

        Path studentDir = studentDirectory(studentId);
        Path backupDir = null;
        boolean previouslyExisted = Files.exists(studentDir);
        try {
            Path rollbackRoot = storageRoot.resolve(".rollback").normalize();
            Files.createDirectories(rollbackRoot);
            backupDir = Files.createTempDirectory(rollbackRoot, studentId + "-");
            if (previouslyExisted) {
                copyDirectory(studentDir, backupDir);
            }
            return new StorageUpdate(studentDir, backupDir, previouslyExisted, lock);
        } catch (IOException ex) {
            deleteTreeQuietly(backupDir);
            lock.unlock();
            throw new ResponseStatusException(BAD_REQUEST, "Could not prepare enrollment storage.", ex);
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
        return protectedMediaService.facePhotoUrl(studentId);
    }

    public String capturePhotoUrl(UUID studentId, String pose) {
        String safe = safePose(pose);
        return protectedMediaService.faceCaptureUrl(studentId, safe);
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

    private void writeAtomically(Path destination, byte[] bytes) throws IOException {
        Path parent = destination.getParent();
        Files.createDirectories(parent);
        Path temporary = Files.createTempFile(parent, ".upload-", ".tmp");
        try {
            Files.write(temporary, bytes);
            try {
                Files.move(temporary, destination,
                        StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException ex) {
                Files.move(temporary, destination, StandardCopyOption.REPLACE_EXISTING);
            }
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private void copyDirectory(Path source, Path destination) throws IOException {
        try (Stream<Path> paths = Files.walk(source)) {
            for (Path path : paths.toList()) {
                Path target = destination.resolve(source.relativize(path));
                if (Files.isDirectory(path)) {
                    Files.createDirectories(target);
                } else {
                    Files.copy(path, target, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        }
    }

    private void deleteTree(Path root) throws IOException {
        if (root == null || !Files.exists(root)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(root)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        }
    }

    private void deleteTreeQuietly(Path root) {
        try {
            deleteTree(root);
        } catch (IOException ex) {
            LOGGER.warn("Could not remove face-enrollment rollback data at {}", root, ex);
        }
    }

    private String storedPose(String pose) {
        if (pose == null || pose.isBlank()) {
            return "unknown";
        }
        String safe = pose.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "_");
        return safe.isBlank() ? "unknown" : safe;
    }

    public final class StorageUpdate {
        private final Path studentDir;
        private final Path backupDir;
        private final boolean previouslyExisted;
        private final ReentrantLock lock;
        private boolean finished;

        private StorageUpdate(
                Path studentDir,
                Path backupDir,
                boolean previouslyExisted,
                ReentrantLock lock
        ) {
            this.studentDir = studentDir;
            this.backupDir = backupDir;
            this.previouslyExisted = previouslyExisted;
            this.lock = lock;
        }

        public synchronized void commit() {
            if (finished) {
                return;
            }
            finished = true;
            deleteTreeQuietly(backupDir);
            lock.unlock();
        }

        public synchronized void rollback() {
            if (finished) {
                return;
            }
            finished = true;
            try {
                deleteTree(studentDir);
                if (previouslyExisted) {
                    Files.move(backupDir, studentDir, StandardCopyOption.REPLACE_EXISTING);
                } else {
                    deleteTree(backupDir);
                }
            } catch (IOException ex) {
                LOGGER.error("Could not restore face-enrollment files for {}", studentDir.getFileName(), ex);
            } finally {
                deleteTreeQuietly(backupDir);
                lock.unlock();
            }
        }
    }
}
