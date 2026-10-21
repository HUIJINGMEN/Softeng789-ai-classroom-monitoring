package io.github.huijingmen.softeng789.classroommonitoring.vision;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.service.StaffAccessService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.Semaphore;
import java.util.function.Supplier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@Service
public class VisionService {
    public static final String NOTICE = "adult-pilot-v1";
    private final FaceProfileRepository profiles;
    private final PhotoReviewRepository reviews;
    private final StudentCheckInRepository checkins;
    private final CourseEnrollmentRepository enrollments;
    private final ClassroomSessionRepository sessions;
    private final AttendanceRecordRepository attendance;
    private final StaffAccessService access;
    private final VisionGateway gateway;
    private final VisionCrypto crypto;
    private final ObjectMapper json;
    private final EntityManager em;
    private final TransactionTemplate tx;
    // This CPU pilot deliberately admits one inference at a time, without holding a DB transaction.
    private final Semaphore inference = new Semaphore(1);

    public VisionService(FaceProfileRepository profiles, PhotoReviewRepository reviews, StudentCheckInRepository checkins,
            CourseEnrollmentRepository enrollments, ClassroomSessionRepository sessions,
            AttendanceRecordRepository attendance, StaffAccessService access, VisionGateway gateway,
            VisionCrypto crypto, ObjectMapper json, EntityManager em, PlatformTransactionManager manager) {
        this.profiles = profiles; this.reviews = reviews; this.checkins = checkins; this.enrollments = enrollments;
        this.sessions = sessions; this.attendance = attendance; this.access = access;
        this.gateway = gateway; this.crypto = crypto; this.json = json; this.em = em;
        tx = new TransactionTemplate(manager);
    }

    public record Profile(boolean enabled, boolean consentActive, boolean enrolled, Instant expiresAt, String noticeVersion) {}
    public record Consent(boolean granted, boolean adultConfirmed, String noticeVersion) {}
    public record Decision(String faceId, UUID studentId, String status) {}
    public record ReviewRequest(boolean teacherConfirmed, List<Decision> decisions) {}
    public record ReviewResult(UUID id, String state, Instant expiresAt, JsonNode result) {}
    record Snapshot(ArrayNode subjects, ArrayNode roster) {}

    public Profile profile(UUID studentId) {
        return tx.execute(s -> profileView(profiles.findById(studentId).orElse(null)));
    }
    private Profile profileView(FaceProfile p) {
        boolean active = p != null && p.active();
        return new Profile(gateway.enabled(), active, active && p.encryptedTemplates != null,
                p == null ? null : p.expiresAt, NOTICE);
    }
    public Profile consent(UUID studentId, Consent request) {
        if (request == null) throw new ResponseStatusException(BAD_REQUEST, "Consent choice is required.");
        return tx.execute(s -> {
            Student student = student(studentId);
            FaceProfile p = profiles.findById(studentId).orElseGet(FaceProfile::new);
            if (request.granted()) {
                gateway.requireEnabled();
                requireEligible(student);
                if (!request.adultConfirmed() || !NOTICE.equals(request.noticeVersion()))
                    throw new ResponseStatusException(BAD_REQUEST, "Read the current notice and confirm you are an adult volunteer.");
                if (p.active()) return profileView(p);
                p.studentId = studentId; p.consentAt = Instant.now(); p.revokedAt = null;
                p.expiresAt = Instant.now().plus(30, ChronoUnit.DAYS); p.noticeVersion = NOTICE;
            } else {
                if (p.studentId == null) return profileView(null);
                p.revokedAt = Instant.now();
            }
            p.revision = UUID.randomUUID(); p.eraseTemplate(); profiles.save(p);
            // Any pending candidate list involving this student is now stale and must be erased.
            invalidateReviews(studentId);
            return profileView(p);
        });
    }
    public Profile enroll(UUID teacher, UUID studentId, boolean confirmed, List<byte[]> images) {
        gateway.requireEnabled();
        if (!confirmed || images.size() != 7) throw new ResponseStatusException(BAD_REQUEST,
                "The teacher must check the student's identity and all seven live captures in person.");
        checkImages(images);
        UUID revision = tx.execute(s -> {
            access.requireStudentAccess(teacher, studentId);
            requireEligible(student(studentId));
            return activeProfile(studentId).revision;
        });
        JsonNode result = infer(() -> gateway.enroll(images));
        validateEnrollment(result);
        return tx.execute(s -> {
            access.requireStudentAccess(teacher, studentId);
            requireEligible(student(studentId));
            FaceProfile p = activeProfile(studentId);
            if (!revision.equals(p.revision)) throw stale();
            p.encryptedTemplates = crypto.encrypt("template:" + studentId, result.path("templates").toString());
            p.modelVersion = result.path("modelVersion").asText(); p.enrolledBy = teacher;
            p.enrolledAt = Instant.now(); p.revision = UUID.randomUUID();
            invalidateReviews(studentId);
            profiles.save(p);
            return profileView(p);
        });
    }

    public List<Map<String, Object>> roster(UUID teacher, UUID sessionId) {
        return tx.execute(s -> {
            access.requireSessionAccess(teacher, sessionId);
            return rosterStudents(sessionId).stream().map(st -> {
                Profile p = profileView(profiles.findById(st.getId()).orElse(null));
                return Map.<String, Object>of("studentId", st.getId(), "name", st.getFullName(),
                        "studentNumber", st.getStudentNumber(), "consentActive", p.consentActive(), "enrolled", p.enrolled());
            }).toList();
        });
    }

    public ReviewResult recognize(UUID teacher, UUID sessionId, UUID requestKey, byte[] image, boolean confirmed) {
        gateway.requireEnabled(); checkImages(List.of(image));
        if (!confirmed) throw new ResponseStatusException(BAD_REQUEST, "Confirm that everyone in this photo consented to capture and biometric processing.");
        String digest = digest(image);
        ReviewResult previous = tx.execute(s -> {
            access.requireSessionAccess(teacher, sessionId);
            return reviews.findByRequestedByAndRequestKey(teacher, requestKey).map(r -> {
                if (!r.sessionId.equals(sessionId) || !r.requestDigest.equals(digest))
                    throw new ResponseStatusException(CONFLICT, "Request key was already used for a different photo or session.");
                return view(r);
            }).orElse(null);
        });
        if (previous != null) return previous;
        Snapshot snapshot = tx.execute(s -> snapshot(teacher, sessionId));
        JsonNode result = infer(() -> gateway.recognize(image, snapshot.subjects().toString()));
        validateRecognition(result, snapshot);
        return tx.execute(s -> {
            access.requireSessionAccess(teacher, sessionId);
            validateRoster(sessionId, snapshot.roster());
            PhotoReview review = new PhotoReview();
            review.id = UUID.randomUUID(); review.sessionId = sessionId; review.requestedBy = teacher;
            review.requestKey = requestKey; review.requestDigest = digest; review.state = "PENDING";
            review.createdAt = Instant.now(); review.expiresAt = Instant.now().plus(30, ChronoUnit.MINUTES);
            snapshot.roster().forEach(n -> review.subjectIds.add(UUID.fromString(n.path("studentId").asText())));
            ObjectNode payload = json.createObjectNode(); payload.set("recognition", result); payload.set("roster", snapshot.roster());
            review.encryptedResult = crypto.encrypt("review:" + review.id, payload.toString());
            reviews.saveAndFlush(review);
            return view(review);
        });
    }
    public ReviewResult getReview(UUID teacher, UUID id) {
        return tx.execute(s -> {
            PhotoReview r = findReview(id, false); access.requireSessionAccess(teacher, r.sessionId);
            return view(r);
        });
    }
    public ReviewResult review(UUID teacher, UUID id, ReviewRequest request) {
        validateDecisions(request);
        return tx.execute(s -> {
            PhotoReview r = findReview(id, false); access.requireSessionAccess(teacher, r.sessionId);
            // Lock the session row alone: FOR UPDATE over nullable graph joins fails in PostgreSQL.
            ClassroomSession session = em.find(ClassroomSession.class, r.sessionId);
            em.refresh(session, LockModeType.PESSIMISTIC_WRITE);
            access.requireSessionAccess(teacher, r.sessionId);
            em.refresh(r);
            checkExpiry(r);
            String decision = encode(request.decisions().stream().sorted(Comparator.comparing(Decision::faceId, Comparator.nullsFirst(String::compareTo))).toList());
            if ("REVIEWED".equals(r.state)) {
                if (decision.equals(crypto.decrypt("decision:" + id, r.encryptedDecision))) return view(r);
                throw new ResponseStatusException(CONFLICT, "This photo has already been reviewed with different decisions.");
            }
            JsonNode payload = decode(crypto.decrypt("review:" + id, r.encryptedResult));
            validateRoster(r.sessionId, payload.path("roster"));
            em.refresh(r, LockModeType.PESSIMISTIC_WRITE);
            checkExpiry(r);
            Set<String> faces = new HashSet<>(); payload.path("recognition").path("faces").forEach(f -> faces.add(f.path("faceId").asText()));
            Set<String> seen = new HashSet<>(); Set<UUID> chosen = new HashSet<>();
            Map<UUID, JsonNode> roster = new HashMap<>(); payload.path("roster").forEach(p -> roster.put(UUID.fromString(p.path("studentId").asText()), p));
            for (Decision d : request.decisions()) {
                if (!faces.contains(d.faceId()) || !seen.add(d.faceId())) throw new ResponseStatusException(BAD_REQUEST, "Review every face exactly once.");
                if (d.studentId() == null) {
                    if (!"EXCLUDE".equals(d.status())) throw new ResponseStatusException(BAD_REQUEST, "Unmatched faces must be excluded.");
                    continue;
                }
                if (!roster.containsKey(d.studentId()) || !chosen.add(d.studentId()) || !Set.of("PRESENT", "LATE").contains(d.status()))
                    throw new ResponseStatusException(BAD_REQUEST, "Select each eligible student at most once and choose Present or Late.");
                AttendanceRecord record = attendance.findBySession_IdAndStudent_Id(r.sessionId, d.studentId()).orElse(null);
                String expected = roster.get(d.studentId()).path("attendanceVersion").asText();
                if (!attendanceVersion(record).equals(expected) || record != null && record.getStatus() != AttendanceRecord.AttendanceStatus.UNKNOWN)
                    throw new ResponseStatusException(CONFLICT, "Attendance already exists or changed. Use the manual attendance table to review existing marks.");
                if (record == null) record = new AttendanceRecord();
                record.setSession(session); record.setStudent(em.getReference(Student.class, d.studentId()));
                record.setStatus(AttendanceRecord.AttendanceStatus.valueOf(d.status())); record.setSource(AttendanceRecord.AttendanceSource.AI);
                record.setCheckInTime(Instant.now()); record.setCheckOutTime(null); record.setAbsenceNote(null); record.setAbsenceReason(null);
                attendance.saveAndFlush(record);
            }
            if (!seen.equals(faces)) throw new ResponseStatusException(BAD_REQUEST, "Review every detected face, including exclusions.");
            r.state = "REVIEWED"; r.reviewedBy = teacher; r.reviewedAt = Instant.now();
            r.encryptedDecision = crypto.encrypt("decision:" + id, decision); reviews.save(r);
            return view(r);
        });
    }

    private Snapshot snapshot(UUID teacher, UUID sessionId) {
        access.requireSessionAccess(teacher, sessionId);
        ArrayNode subjects = json.createArrayNode(); ArrayNode roster = json.createArrayNode();
        List<Student> students = rosterStudents(sessionId);
        if (students.size() > 30) throw new ResponseStatusException(BAD_REQUEST, "The CPU pilot supports classes of up to 30 students.");
        for (Student student : students) {
            FaceProfile p = profiles.findById(student.getId()).orElse(null);
            if (p == null || !p.active() || p.encryptedTemplates == null) continue;
            subjects.addObject().put("studentId", student.getId().toString()).put("modelVersion", p.modelVersion)
                    .set("templates", decode(crypto.decrypt("template:" + student.getId(), p.encryptedTemplates)));
            roster.addObject().put("studentId", student.getId().toString()).put("name", student.getFullName())
                    .put("studentNumber", student.getStudentNumber()).put("revision", p.revision.toString())
                    .put("attendanceVersion", attendanceVersion(attendance.findBySession_IdAndStudent_Id(sessionId, student.getId()).orElse(null)));
        }
        if (subjects.isEmpty()) throw new ResponseStatusException(BAD_REQUEST, "No consenting students have completed face enrollment for this class.");
        return new Snapshot(subjects, roster);
    }
    void validateRoster(UUID sessionId, JsonNode roster) {
        Set<UUID> active = new HashSet<>(); rosterStudents(sessionId).forEach(s -> active.add(s.getId()));
        UUID offeringId = sessions.findById(sessionId).orElseThrow().getCourseOffering().getId();
        List<JsonNode> ordered = new ArrayList<>(); roster.forEach(ordered::add);
        ordered.sort(Comparator.comparing(n -> n.path("studentId").asText()));
        for (JsonNode n : ordered) {
            UUID id = UUID.fromString(n.path("studentId").asText());
            requireEligible(student(id)); // Serializes consent changes and review commits on the student row.
            CourseEnrollment membership = enrollments.findByStudent_IdAndCourseOffering_Id(id, offeringId).orElseThrow(this::stale);
            em.refresh(membership, LockModeType.PESSIMISTIC_READ);
            if (membership.getStatus() != CourseEnrollment.EnrollmentStatus.ACTIVE) throw stale();
            FaceProfile p = activeProfile(id);
            if (!active.contains(id) || p.encryptedTemplates == null || !p.revision.toString().equals(n.path("revision").asText())) throw stale();
        }
    }
    private List<Student> rosterStudents(UUID sessionId) {
        ClassroomSession session = sessions.findById(sessionId).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Session not found."));
        if (session.getCourseOffering() == null) throw new ResponseStatusException(BAD_REQUEST, "This session needs an assigned class.");
        if (session.getStatus() == ClassroomSession.SessionStatus.CANCELLED) throw new ResponseStatusException(BAD_REQUEST, "This session is cancelled.");
        return enrollments.findByCourseOffering_IdAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
                session.getCourseOffering().getId(), CourseEnrollment.EnrollmentStatus.ACTIVE).stream()
                .map(CourseEnrollment::getStudent).filter(s -> "ACTIVE".equals(s.getStatus()) && "APPROVED".equals(s.getApprovalStatus())).toList();
    }
    private Student student(UUID id) {
        Student s = em.find(Student.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (s == null) throw new ResponseStatusException(NOT_FOUND, "Student not found.");
        em.refresh(s);
        return s;
    }
    private void requireEligible(Student s) {
        if (!"ACTIVE".equals(s.getStatus()) || !"APPROVED".equals(s.getApprovalStatus())) throw new ResponseStatusException(CONFLICT, "Only approved, active students can enroll.");
    }
    private FaceProfile activeProfile(UUID id) {
        FaceProfile p = profiles.findById(id).orElseThrow(this::stale);
        if (!p.active()) throw stale();
        return p;
    }
    private ResponseStatusException stale() { return new ResponseStatusException(CONFLICT, "Consent, enrollment or the class roster changed. Capture a new photo after checking consent."); }
    String attendanceVersion(AttendanceRecord r) { return r == null ? "NONE" : r.getId() + ":" + r.getVersion(); }
    private PhotoReview findReview(UUID id, boolean lock) {
        PhotoReview r = lock ? em.find(PhotoReview.class, id, LockModeType.PESSIMISTIC_WRITE) : em.find(PhotoReview.class, id);
        if (r == null) throw new ResponseStatusException(NOT_FOUND, "Photo review not found.");
        return r;
    }
    private void checkExpiry(PhotoReview r) {
        if (!r.expiresAt.isAfter(Instant.now()) || r.encryptedResult == null)
            throw new ResponseStatusException(GONE, "This review expired. Take a new photo or use manual attendance.");
    }
    private ReviewResult view(PhotoReview r) {
        checkExpiry(r);
        ObjectNode payload = (ObjectNode) decode(crypto.decrypt("review:" + r.id, r.encryptedResult));
        payload.path("roster").forEach(n -> ((ObjectNode) n).remove(List.of("revision", "attendanceVersion")));
        return new ReviewResult(r.id, r.state, r.expiresAt, payload);
    }
    private void invalidateReviews(UUID studentId) {
        for (StudentCheckIn r : checkins.findByStudentIdOrderById(studentId)) {
            em.refresh(r, LockModeType.PESSIMISTIC_WRITE);
            r.erasePayload(); checkins.save(r);
        }
        for (PhotoReview r : reviews.findContainingStudent(studentId)) {
            em.refresh(r, LockModeType.PESSIMISTIC_WRITE);
            r.erasePayload(); r.expiresAt = Instant.now(); reviews.save(r);
        }
    }
    @Scheduled(fixedDelay = 60000)
    public void purge() {
        // One profile per transaction avoids holding unrelated student locks while erasing reviews.
        for (UUID id : profiles.findAll().stream().map(p -> p.studentId).toList()) {
            tx.executeWithoutResult(s -> {
                student(id);
                FaceProfile p = profiles.findById(id).orElse(null);
                if (p == null) return;
                if (!p.active() && p.encryptedTemplates != null) {
                    p.eraseTemplate(); p.revision = UUID.randomUUID(); profiles.save(p);
                    invalidateReviews(p.studentId);
                }
            });
        }
        tx.executeWithoutResult(s -> {
            for (PhotoReview r : reviews.findByExpiresAtBefore(Instant.now()).stream().sorted(Comparator.comparing(p -> p.id)).toList()) {
                em.refresh(r, LockModeType.PESSIMISTIC_WRITE);
                if (r.expiresAt.isAfter(Instant.now())) continue;
                if (r.createdAt.isBefore(Instant.now().minus(90, ChronoUnit.DAYS))) reviews.delete(r);
                else { r.erasePayload(); reviews.save(r); }
            }
        });
    }
    private void validateDecisions(ReviewRequest request) {
        if (request == null || !request.teacherConfirmed() || request.decisions() == null || request.decisions().size() > 30)
            throw new ResponseStatusException(BAD_REQUEST, "Teacher confirmation and up to 30 face decisions are required.");
        for (Decision decision : request.decisions()) {
            if (decision == null || decision.faceId() == null || decision.faceId().isBlank() || decision.faceId().length() > 16
                    || decision.status() == null || !Set.of("PRESENT", "LATE", "EXCLUDE").contains(decision.status()))
                throw new ResponseStatusException(BAD_REQUEST, "Each face needs a valid identity or exclusion decision.");
        }
    }
    JsonNode infer(Supplier<JsonNode> action) {
        if (!inference.tryAcquire()) throw new ResponseStatusException(TOO_MANY_REQUESTS, "The CPU recognizer is busy. Retry shortly.");
        try { return action.get(); } finally { inference.release(); }
    }
    void checkImages(List<byte[]> images) {
        long total = images.stream().mapToLong(b -> b.length).sum();
        if (total > 7 * 1024 * 1024 || images.stream().anyMatch(b -> b.length == 0)) throw new ResponseStatusException(PAYLOAD_TOO_LARGE, "Use non-empty JPEG or PNG images totaling at most 7 MB.");
    }
    void validateEnrollment(JsonNode n) {
        if (n == null || !n.path("qualityPassed").asBoolean() || !n.path("templates").isArray() || n.path("templates").size() != 7
                || n.path("modelVersion").asText().isBlank() || n.path("modelVersion").asText().length() > 255) throw invalidService();
        for (JsonNode vector : n.path("templates")) {
            if (!vector.isArray() || vector.size() != 128) throw invalidService();
            double norm = 0;
            for (JsonNode number : vector) {
                if (!number.isNumber() || !Double.isFinite(number.asDouble())) throw invalidService();
                norm += number.asDouble() * number.asDouble();
            }
            if (Math.abs(norm - 1) > .01) throw invalidService();
        }
    }
    void validateRecognition(JsonNode n, Snapshot snapshot) {
        if (n == null || !n.path("faces").isArray() || n.path("faces").size() > 30 || n.path("thresholdVersion").asText().isBlank()) throw invalidService();
        Set<String> ids = new HashSet<>(); snapshot.subjects().forEach(p -> {
            ids.add(p.path("studentId").asText());
            if (!p.path("modelVersion").asText().equals(n.path("modelVersion").asText())) throw invalidService();
        });
        Set<String> faceIds = new HashSet<>();
        for (JsonNode face : n.path("faces")) {
            if (face.path("faceId").asText().isBlank() || !faceIds.add(face.path("faceId").asText()) || !face.path("box").isObject() || face.path("box").size() != 4) throw invalidService();
            for (String key : List.of("x", "y", "width", "height")) {
                JsonNode value = face.path("box").path(key);
                if (!value.isNumber() || !Double.isFinite(value.asDouble()) || value.asDouble() < 0 || value.asDouble() > 1) throw invalidService();
            }
            if (!Set.of("MATCH_CANDIDATE", "UNCERTAIN", "UNKNOWN", "LOW_QUALITY").contains(face.path("decision").asText())
                    || !face.path("qualityReasons").isArray() || !face.path("candidates").isArray() || face.path("candidates").size() > 3) throw invalidService();
            Set<String> candidates = new HashSet<>();
            for (JsonNode candidate : face.path("candidates")) {
                JsonNode score = candidate.path("similarity");
                if (!ids.contains(candidate.path("studentId").asText()) || !candidates.add(candidate.path("studentId").asText())
                        || !score.isNumber() || !Double.isFinite(score.asDouble()) || score.asDouble() < -1 || score.asDouble() > 1) throw invalidService();
            }
        }
    }
    private ResponseStatusException invalidService() { return new ResponseStatusException(BAD_GATEWAY, "The recognizer returned an invalid response. No attendance was changed."); }
    private String digest(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    private String encode(Object value) { try { return json.writeValueAsString(value); } catch (Exception e) { throw new IllegalStateException(e); } }
    private JsonNode decode(String value) { try { return json.readTree(value); } catch (Exception e) { throw new IllegalStateException("Invalid encrypted vision payload."); } }
}
