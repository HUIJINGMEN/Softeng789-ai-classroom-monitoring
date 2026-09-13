package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
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
    private final Path storageRoot;

    public ProgressReportStorageService(
            @Value("${app.storage.progress-report-dir:../data/progress-reports}") String storageRoot
    ) {
        this.storageRoot = Path.of(storageRoot);
    }

    public void savePhoto(UUID reportId, byte[] bytes) {
        try {
            Path reportDir = reportDirectory(reportId);
            Files.createDirectories(reportDir);
            Files.write(photoPath(reportId), bytes);
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not save report photo.", ex);
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
        return "/api/progress-reports/" + reportId + "/photo";
    }

    private Path photoPath(UUID reportId) {
        return reportDirectory(reportId).resolve("photo.jpg").normalize();
    }

    private Path reportDirectory(UUID reportId) {
        return storageRoot.resolve(reportId.toString()).normalize();
    }
}
