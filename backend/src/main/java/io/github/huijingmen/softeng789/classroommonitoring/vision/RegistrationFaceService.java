package io.github.huijingmen.softeng789.classroommonitoring.vision;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RegisterStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.service.FaceCaptureMetadataCodec;
import io.github.huijingmen.softeng789.classroommonitoring.service.ImageUploadService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@Service
public class RegistrationFaceService {
    public static final String NOTICE = "registration-adult-pilot-v1";
    private static final List<String> POSES = List.of("front", "slight_left", "left", "slight_right", "right", "chin_up", "chin_down");
    private final RegistrationFaceRepository rows;
    private final FaceProfileRepository profiles;
    private final VisionService vision;
    private final VisionGateway gateway;
    private final VisionCrypto crypto;
    private final FaceCaptureMetadataCodec metadata;
    private final ImageUploadService images;
    private final ObjectMapper json;
    private final EntityManager em;

    public RegistrationFaceService(RegistrationFaceRepository rows, FaceProfileRepository profiles,
            VisionService vision, VisionGateway gateway, VisionCrypto crypto, FaceCaptureMetadataCodec metadata,
            ImageUploadService images, ObjectMapper json, EntityManager em) {
        this.rows = rows; this.profiles = profiles; this.vision = vision; this.gateway = gateway;
        this.crypto = crypto; this.metadata = metadata; this.images = images; this.json = json; this.em = em;
    }

    public record Prepared(String mode, String payload, Instant submittedAt) {}
    public record Summary(String attendanceMode, String faceReviewState) {}
    public record Review(String attendanceMode, String state, Instant expiresAt, List<String> photos) {}

    /** No account/class writes or DB transaction during image validation and inference. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Prepared prepare(RegisterStudentRequest request, String captureMetadata, List<MultipartFile> captures) {
        String mode = request.attendanceMode();
        if (!Set.of("MANUAL", "FACE").contains(mode)) throw new ResponseStatusException(BAD_REQUEST, "Choose manual or face attendance.");
        if ("MANUAL".equals(mode)) {
            if (request.consentGiven() || captures != null && !captures.isEmpty())
                throw new ResponseStatusException(BAD_REQUEST, "Manual attendance does not accept face photos or biometric consent.");
            return new Prepared(mode, null, Instant.now());
        }
        gateway.requireEnabled();
        if (!request.consentGiven() || !Boolean.TRUE.equals(request.adultConfirmed()) || !NOTICE.equals(request.noticeVersion()))
            throw new ResponseStatusException(BAD_REQUEST, "Read the registration notice and confirm adult volunteer consent, or choose manual attendance.");
        if (captures == null || captures.size() != 7 || captures.stream().mapToLong(MultipartFile::getSize).sum() > 7 * 1024 * 1024)
            throw new ResponseStatusException(BAD_REQUEST, "Seven webcam captures totaling at most 7 MB are required.");
        var entries = metadata.parseRequired(captureMetadata);
        if (entries == null || entries.size() != 7 || entries.stream().anyMatch(Objects::isNull)
                || !entries.stream().map(e -> e.pose()).toList().equals(POSES))
            throw new ResponseStatusException(BAD_REQUEST, "Complete all seven distinct capture prompts.");
        List<byte[]> normalized = captures.stream().map(images::normaliseToJpeg).toList();
        vision.checkImages(normalized);
        JsonNode result = vision.infer(() -> gateway.enroll(normalized));
        vision.validateEnrollment(result);
        var payload = json.createObjectNode();
        payload.set("enrollment", result);
        var photos = payload.putArray("photos");
        normalized.forEach(b -> photos.add("data:image/jpeg;base64," + Base64.getEncoder().encodeToString(b)));
        return new Prepared(mode, payload.toString(), Instant.now());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void save(UUID studentId, Prepared prepared) {
        // A claimed roster record may have an older profile. New consent requires fresh approval.
        vision.consent(studentId, new VisionService.Consent(false, false, null));
        RegistrationFace row = new RegistrationFace();
        row.studentId = studentId; row.attendanceMode = prepared.mode(); row.state = "PENDING";
        row.submittedAt = prepared.submittedAt(); row.expiresAt = prepared.submittedAt().plus(7, ChronoUnit.DAYS);
        if (prepared.payload() != null) {
            row.noticeVersion = NOTICE;
            row.encryptedPayload = crypto.encrypt("registration:" + studentId, prepared.payload());
        }
        rows.save(row);
    }

    @Transactional(readOnly = true)
    public Summary summary(UUID id) {
        return rows.findById(id).map(r -> new Summary(r.attendanceMode, effectiveState(r)))
                .orElse(new Summary("MANUAL", "NOT_REQUESTED"));
    }

    @Transactional(readOnly = true)
    public Review review(UUID id) {
        Student student = em.find(Student.class, id);
        if (student == null || !"PENDING".equals(student.getApprovalStatus()))
            throw new ResponseStatusException(NOT_FOUND, "Pending registration not found.");
        RegistrationFace row = rows.findById(id).orElse(null);
        if (row == null) return new Review("MANUAL", "NOT_REQUESTED", null, List.of());
        List<String> photos = new ArrayList<>();
        if ("FACE".equals(row.attendanceMode) && "PENDING".equals(effectiveState(row)))
            payload(row).path("photos").forEach(n -> photos.add(n.asText()));
        return new Review(row.attendanceMode, effectiveState(row), row.expiresAt, photos);
    }

    /** Called inside the account decision transaction; the same lock serializes expiry and rejection. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Student lockStudent(UUID id) {
        Student student = em.find(Student.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (student == null) throw new ResponseStatusException(NOT_FOUND, "Student not found.");
        em.refresh(student);
        return student;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void approve(UUID id, UUID admin, boolean identityConfirmed) {
        RegistrationFace row = rows.findById(id).orElse(null);
        if (row == null) return; // Existing registrations retain their existing approval contract.
        if (admin == null || !identityConfirmed)
            throw new ResponseStatusException(BAD_REQUEST, "An administrator must confirm the student's identity before approval.");
        if ("FACE".equals(row.attendanceMode)) {
            gateway.requireEnabled();
            if (!"PENDING".equals(effectiveState(row))) throw new ResponseStatusException(CONFLICT,
                    "Registration photos expired. The student can switch to manual attendance, then enroll later.");
            JsonNode result = payload(row).path("enrollment");
            vision.validateEnrollment(result);
            FaceProfile profile = profiles.findById(id).orElseGet(FaceProfile::new);
            profile.studentId = id; profile.revision = UUID.randomUUID();
            profile.consentAt = row.submittedAt; profile.expiresAt = row.submittedAt.plus(30, ChronoUnit.DAYS);
            profile.revokedAt = null; profile.noticeVersion = row.noticeVersion;
            profile.encryptedTemplates = crypto.encrypt("template:" + id, result.path("templates").toString());
            profile.modelVersion = result.path("modelVersion").asText(); profile.enrolledBy = admin; profile.enrolledAt = Instant.now();
            profiles.save(profile);
        }
        row.state = "APPROVED"; row.reviewedBy = admin; row.reviewedAt = Instant.now(); row.encryptedPayload = null;
        rows.save(row);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void reject(UUID id) {
        rows.findById(id).ifPresent(row -> { row.encryptedPayload = null; row.state = "REJECTED"; row.reviewedAt = Instant.now(); rows.save(row); });
    }

    @Transactional
    public void useManual(UUID id) {
        Student student = lockStudent(id);
        if (!"PENDING".equals(student.getApprovalStatus())) throw new ResponseStatusException(CONFLICT, "Registration is no longer pending.");
        rows.findById(id).ifPresent(row -> { row.attendanceMode = "MANUAL"; row.encryptedPayload = null; row.noticeVersion = null; row.state = "PENDING"; rows.save(row); });
        student.setConsentGiven(false);
    }

    @Scheduled(fixedDelay = 60000)
    @Transactional
    public void purge() {
        for (RegistrationFace row : rows.findByStateAndExpiresAtBefore("PENDING", Instant.now())) {
            if (!"FACE".equals(row.attendanceMode)) continue;
            lockStudent(row.studentId); em.refresh(row);
            if ("EXPIRED".equals(effectiveState(row))) { row.encryptedPayload = null; row.state = "EXPIRED"; rows.save(row); }
        }
    }
    private String effectiveState(RegistrationFace row) {
        return "FACE".equals(row.attendanceMode) && "PENDING".equals(row.state) && !row.expiresAt.isAfter(Instant.now()) ? "EXPIRED" : row.state;
    }
    private JsonNode payload(RegistrationFace row) {
        try { return json.readTree(crypto.decrypt("registration:" + row.studentId, row.encryptedPayload)); }
        catch (Exception e) { throw new ResponseStatusException(CONFLICT, "Registration photos are unavailable. Switch to manual attendance."); }
    }
}
