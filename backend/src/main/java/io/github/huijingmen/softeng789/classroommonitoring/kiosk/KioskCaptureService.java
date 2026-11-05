package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import io.github.huijingmen.softeng789.classroommonitoring.vision.*;
import jakarta.persistence.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import static org.springframework.http.HttpStatus.*;
import static io.github.huijingmen.softeng789.classroommonitoring.kiosk.KioskProblem.*;
import static io.github.huijingmen.softeng789.classroommonitoring.kiosk.KioskViews.*;

@Service
public class KioskCaptureService {
    private final KioskSessionService sessions;
    private final KioskPayloads payloads;
    private final VisionService vision;
    private final VisionGateway gateway;
    private final EntityManager em;
    public KioskCaptureService(KioskSessionService sessions, KioskPayloads payloads, VisionService vision, VisionGateway gateway, EntityManager em) {
        this.sessions = sessions; this.payloads = payloads; this.vision = vision; this.gateway = gateway; this.em = em;
    }
    public record Capture(Map<String, Object> body, boolean replayed) {
        @Override public String toString() { return "[redacted kiosk capture result]"; }
    }
    private record Reservation(UUID id, VisionService.Snapshot snapshot, Capture replay) {
        @Override public String toString() { return "[redacted kiosk reservation]"; }
    }
    static String contentType(byte[] image) {
        if (image == null || image.length == 0) throw problem(BAD_REQUEST, "INVALID_IMAGE", "Upload a JPEG or PNG image.");
        if (image.length > 2097152) throw problem(PAYLOAD_TOO_LARGE, "IMAGE_TOO_LARGE", "The image must be at most 2 MB.");
        if (image.length >= 3 && (image[0] & 255) == 255 && (image[1] & 255) == 216 && (image[2] & 255) == 255) return "image/jpeg";
        byte[] png = {(byte)137, 80, 78, 71, 13, 10, 26, 10};
        if (image.length >= png.length && Arrays.equals(Arrays.copyOf(image, png.length), png)) return "image/png";
        throw problem(BAD_REQUEST, "INVALID_IMAGE", "Upload a JPEG or PNG image with a valid image signature.");
    }
    private String digest(byte[] image) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(image)); }
        catch (Exception e) { throw new IllegalStateException("SHA-256 is required."); }
    }
    public Capture capture(UUID kiosk, UUID key, byte[] image) {
        if (key == null) throw problem(BAD_REQUEST, "VALIDATION_FAILED", "An Idempotency-Key UUID is required.");
        String type = contentType(image); vision.checkImages(List.of(image)); String digest = digest(image);
        Reservation reservation = sessions.tx.execute(s -> reserve(kiosk, key, digest, image, type));
        if (reservation.replay != null) return reservation.replay;
        JsonNode result;
        try {
            // Never hold row locks or a database transaction while calling the recognizer.
            result = vision.infer(() -> gateway.recognize(image, reservation.snapshot.subjects().toString()));
            vision.validateRecognition(result, reservation.snapshot);
        } catch (RuntimeException e) {
            // Failed inference is retryable with the same key; no terminal recognition result exists.
            sessions.tx.executeWithoutResult(s -> {
                var a = em.find(KioskAttempt.class, reservation.id, LockModeType.PESSIMISTIC_WRITE);
                if (a != null && a.open() && a.encryptedCandidates == null) em.remove(a);
            });
            if (e instanceof KioskProblem p) throw p;
            if (e instanceof ResponseStatusException r && r.getStatusCode().value() == 429)
                throw problem(TOO_MANY_REQUESTS, "RECOGNIZER_BUSY", "The recognizer is busy. Retry shortly.");
            if (e instanceof ResponseStatusException r && r.getStatusCode().value() == 502)
                throw problem(BAD_GATEWAY, "RECOGNIZER_INVALID_RESPONSE", "The recognizer returned an invalid response.");
            throw problem(SERVICE_UNAVAILABLE, "RECOGNITION_UNAVAILABLE", "Face recognition is unavailable. Please try again.");
        }
        var completed = sessions.tx.execute(s -> complete(kiosk, reservation, result));
        if (!sessions.resolve(kiosk)) throw new ResponseStatusException(UNAUTHORIZED, "Sign in required.");
        if ("SESSION_CLOSED".equals(completed.body().get("state")))
            throw problem(CONFLICT, "KIOSK_SESSION_CLOSED", "This class session is closed.");
        return completed;
    }
    private Reservation reserve(UUID kiosk, UUID key, String digest, byte[] image, String type) {
        var k = sessions.kiosk(kiosk, false);
        var c = sessions.classroom(k.sessionId, true);
        k = sessions.kiosk(kiosk, true); sessions.requireActive(k);
        var previous = em.createQuery("select a from KioskAttempt a where a.kioskSessionId = :k and a.requestKey = :key", KioskAttempt.class)
                .setParameter("k", kiosk).setParameter("key", key).getResultList();
        if (!previous.isEmpty()) {
            var a = previous.getFirst(); em.refresh(a, LockModeType.PESSIMISTIC_WRITE);
            if (!a.requestDigest.equals(digest)) throw problem(CONFLICT, "IDEMPOTENCY_KEY_REUSED", "This request key was used for a different image.");
            if (a.open() && !KioskTime.now().isBefore(a.expiresAt)) payloads.finish(a, "EXPIRED");
            if (a.open() && a.encryptedCandidates == null) throw problem(TOO_MANY_REQUESTS, "RECOGNIZER_BUSY", "This capture is still being processed.");
            return new Reservation(a.id, null, new Capture(view(a, List.of()), true));
        }
        String window = window(c, KioskTime.now());
        if ("CLOSED".equals(window)) throw problem(CONFLICT, "KIOSK_SESSION_CLOSED", "This class session is closed.");
        if (!"OPEN".equals(window)) throw problem(CONFLICT, "KIOSK_WINDOW_NOT_OPEN", "Attendance capture opens 15 minutes before class.");
        if (!gateway.enabled()) throw problem(SERVICE_UNAVAILABLE, "RECOGNITION_UNAVAILABLE", "Face recognition is unavailable.");
        var roster = sessions.roster(c);
        if (roster.size() > 30) throw blocked("ROSTER_TOO_LARGE");
        if (sessions.ready(roster) == 0) throw problem(CONFLICT, "NO_FACE_READY_STUDENTS", "No students are ready for face attendance.");
        Instant now = KioskTime.now();
        if (k.lastCaptureAt != null && now.isBefore(k.lastCaptureAt.plusSeconds(2)))
            throw problem(TOO_MANY_REQUESTS, "CAPTURE_RATE_LIMITED", "Wait two seconds between captures.");
        // Reserve the key before inference, so another process cannot submit it a second time.
        var snapshot = vision.snapshot(k.launchedBy, k.sessionId);
        for (var old : em.createQuery("select a from KioskAttempt a where a.kioskSessionId = :id and a.state = 'AWAITING_SELECTION' order by a.id", KioskAttempt.class)
                .setParameter("id", k.id).getResultList()) {
            em.refresh(old, LockModeType.PESSIMISTIC_WRITE); payloads.finish(old, "SUPERSEDED");
        }
        var a = new KioskAttempt(); a.id = UUID.randomUUID(); a.kioskSessionId = kiosk; a.sessionId = k.sessionId;
        a.campusId = k.campusId; a.locationLabel = k.locationLabel; a.requestKey = key; a.requestDigest = digest;
        a.state = "AWAITING_SELECTION"; a.capturedAt = now; a.expiresAt = now.plusSeconds(120);
        a.encryptedCapture = payloads.crypto.encrypt("kiosk-capture:" + a.id, payloads.json.createObjectNode()
                .put("contentType", type).put("image", Base64.getEncoder().encodeToString(image)).toString());
        k.lastCaptureAt = now; em.persist(a); em.flush();
        return new Reservation(a.id, snapshot, null);
    }
    private Capture complete(UUID kiosk, Reservation reservation, JsonNode result) {
        var k = sessions.kiosk(kiosk, false); var c = sessions.classroom(k.sessionId, true); k = sessions.kiosk(kiosk, true);
        var a = em.find(KioskAttempt.class, reservation.id, LockModeType.PESSIMISTIC_WRITE);
        if (a == null) throw problem(CONFLICT, "KIOSK_SESSION_CLOSED", "This capture is no longer available.");
        if (!a.open()) return new Capture(view(a, List.of()), false);
        if (!KioskTime.now().isBefore(a.expiresAt)) { payloads.finish(a, "EXPIRED"); return new Capture(view(a, List.of()), false); }
        if (k.endedAt != null || !KioskTime.now().isBefore(k.expiresAt) || !sessions.eligible(k) || !"OPEN".equals(window(c, KioskTime.now()))) {
            payloads.finish(a, "SESSION_CLOSED"); return new Capture(view(a, List.of()), false);
        }
        var faces = result.path("faces"); String outcome; var reasons = new ArrayList<String>();
        if (faces.isEmpty()) outcome = "NO_FACE";
        else if (faces.size() > 1) outcome = "MULTIPLE_FACES";
        else {
            var face = faces.get(0); a.recognitionDecision = face.path("decision").asText();
            face.path("qualityReasons").forEach(n -> reasons.add(n.isTextual()
                    && Set.of("FACE_TOO_SMALL", "BLUR", "LIGHTING", "DUPLICATE_IDENTITY").contains(n.asText()) ? n.asText() : "OTHER"));
            if ("LOW_QUALITY".equals(a.recognitionDecision)) {
                outcome = "LOW_QUALITY";
            } else if ("UNKNOWN".equals(a.recognitionDecision) || face.path("candidates").isEmpty()) outcome = "NO_CANDIDATE";
            else {
                outcome = "CANDIDATES";
                var candidates = payloads.candidateSnapshot(face, reservation.snapshot);
                a.candidateCount = (short) candidates.size();
                a.encryptedCandidates = payloads.crypto.encrypt("kiosk-candidates:" + a.id, candidates.toString());
            }
        }
        a.qualityReasons = payloads.json.writeValueAsString(reasons);
        if (!"CANDIDATES".equals(outcome)) payloads.finish(a, outcome);
        return new Capture(view(a, reasons), false);
    }
    Map<String, Object> view(KioskAttempt a, List<String> reasons) {
        if (a.qualityReasons != null) {
            reasons = new ArrayList<>();
            for (var reason : payloads.json.readTree(a.qualityReasons)) reasons.add(reason.asText());
        }
        String outcome = a.candidateCount > 0 ? "CANDIDATES" : Set.of("NO_FACE", "MULTIPLE_FACES", "LOW_QUALITY", "NO_CANDIDATE").contains(a.state)
                ? a.state : "NO_CANDIDATE";
        return fields("attemptId", a.id, "outcome", outcome, "state", a.state, "qualityReasons", reasons,
                "candidates", payloads.candidateCards(a), "capturedAt", a.capturedAt, "expiresAt", a.expiresAt);
    }
}
