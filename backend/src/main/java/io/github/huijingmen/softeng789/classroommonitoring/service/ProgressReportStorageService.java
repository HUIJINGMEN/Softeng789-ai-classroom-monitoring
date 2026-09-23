package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.UUID;
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

/** One photo per progress report, stored on disk the same way {@code FaceEnrollmentStorageService}
 *  stores face-enrollment images — a predictable path derived from the report id, no path column
 *  needed in the database. */
@Service
public class ProgressReportStorageService {
    private static final Logger LOGGER = LoggerFactory.getLogger(ProgressReportStorageService.class);

    private final Path storageRoot;
    private final ProtectedMediaService protectedMediaService;

    public ProgressReportStorageService(
            ProtectedMediaService protectedMediaService,
            @Value("${app.storage.progress-report-dir:../data/progress-reports}") String storageRoot
    ) {
        this.protectedMediaService = protectedMediaService;
        this.storageRoot = Path.of(storageRoot);
    }

    public void savePhoto(UUID reportId, byte[] bytes) {
        Path temporary = null;
        try {
            Path reportDir = reportDirectory(reportId);
            Files.createDirectories(reportDir);
            temporary = Files.createTempFile(reportDir, ".upload-", ".tmp");
            Files.write(temporary, bytes);
            try {
                Files.move(temporary, photoPath(reportId),
                        StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException ex) {
                Files.move(temporary, photoPath(reportId), StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not save report photo.", ex);
        } finally {
            deleteFileQuietly(temporary);
        }
    }

    public void deleteReportFiles(UUID reportId) {
        Path reportDir = reportDirectory(reportId);
        try {
            if (!Files.exists(reportDir)) {
                return;
            }
            try (Stream<Path> paths = Files.walk(reportDir)) {
                for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                    Files.deleteIfExists(path);
                }
            }
        } catch (IOException ex) {
            LOGGER.error("Could not remove files for progress report {}", reportId, ex);
        }
    }

    public Resource photo(UUID reportId) {
        Path photo = photoPath(reportId);
        if (!Files.isRegularFile(photo)) {
            throw new ResponseStatusException(NOT_FOUND, "Report photo not found.");
        }
        return new FileSystemResource(photo);
    }

    // A web-created report (text-only feedback) has no photo at all — there's no database column
    // tracking that, so existence on disk is the source of truth, same as photo()'s own check.
    public boolean hasPhoto(UUID reportId) {
        return Files.isRegularFile(photoPath(reportId));
    }

    public String photoUrl(UUID reportId) {
        return protectedMediaService.progressReportPhotoUrl(reportId);
    }

    private Path photoPath(UUID reportId) {
        return reportDirectory(reportId).resolve("photo.jpg").normalize();
    }

    private Path reportDirectory(UUID reportId) {
        return storageRoot.resolve(reportId.toString()).normalize();
    }

    private void deleteFileQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException ex) {
            LOGGER.warn("Could not remove temporary progress-report upload {}", path, ex);
        }
    }
}
