package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.FORBIDDEN;

/**
 * Issues short-lived, opaque grants for images rendered by plain {@code <img>} elements. Browser
 * image requests cannot attach the application's bearer token, so returning a random grant in the
 * URL protects the media without exposing a session credential in query strings or logs.
 */
@Service
public class ProtectedMediaService {
    private static final Duration GRANT_LIFETIME = Duration.ofMinutes(15);
    private static final Duration CLEANUP_INTERVAL = Duration.ofMinutes(1);

    private final Map<String, MediaGrant> grants = new ConcurrentHashMap<>();
    private final AtomicReference<Instant> lastCleanup = new AtomicReference<>(Instant.EPOCH);
    private final Clock clock;

    public ProtectedMediaService() {
        this(Clock.systemUTC());
    }

    ProtectedMediaService(Clock clock) {
        this.clock = clock;
    }

    public String facePhotoUrl(UUID studentId) {
        return issue(MediaKind.FACE_PRIMARY, studentId, null,
                "/api/students/" + studentId + "/face-enrollment/photo");
    }

    public String faceCaptureUrl(UUID studentId, String pose) {
        return issue(MediaKind.FACE_CAPTURE, studentId, pose,
                "/api/students/" + studentId + "/face-enrollment/captures/" + pose + "/photo");
    }

    public String progressReportPhotoUrl(UUID reportId) {
        return issue(MediaKind.PROGRESS_REPORT, reportId, null,
                "/api/progress-reports/" + reportId + "/photo");
    }

    public void requireFacePhoto(String token, UUID studentId) {
        require(token, MediaKind.FACE_PRIMARY, studentId, null);
    }

    public void requireFaceCapture(String token, UUID studentId, String pose) {
        require(token, MediaKind.FACE_CAPTURE, studentId, pose);
    }

    public void requireProgressReportPhoto(String token, UUID reportId) {
        require(token, MediaKind.PROGRESS_REPORT, reportId, null);
    }

    private String issue(MediaKind kind, UUID resourceId, String variant, String path) {
        Instant now = clock.instant();
        removeExpiredIfDue(now);
        String token = UUID.randomUUID().toString();
        grants.put(token, new MediaGrant(kind, resourceId, variant, now.plus(GRANT_LIFETIME)));
        return path + "?access=" + token;
    }

    private void require(String token, MediaKind kind, UUID resourceId, String variant) {
        Instant now = clock.instant();
        MediaGrant grant = token == null ? null : grants.get(token);
        if (grant == null
                || grant.expiresAt().isBefore(now)
                || grant.kind() != kind
                || !grant.resourceId().equals(resourceId)
                || !java.util.Objects.equals(grant.variant(), variant)) {
            if (token != null) {
                grants.remove(token);
            }
            throw new ResponseStatusException(FORBIDDEN, "This media link is invalid or has expired.");
        }
    }

    private void removeExpiredIfDue(Instant now) {
        Instant previous = lastCleanup.get();
        if (previous.plus(CLEANUP_INTERVAL).isAfter(now)
                || !lastCleanup.compareAndSet(previous, now)) {
            return;
        }
        grants.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
    }

    private enum MediaKind {
        FACE_PRIMARY,
        FACE_CAPTURE,
        PROGRESS_REPORT
    }

    private record MediaGrant(MediaKind kind, UUID resourceId, String variant, Instant expiresAt) {
    }
}
