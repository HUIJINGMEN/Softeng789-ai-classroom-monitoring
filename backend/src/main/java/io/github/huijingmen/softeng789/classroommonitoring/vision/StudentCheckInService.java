package io.github.huijingmen.softeng789.classroommonitoring.vision;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.service.StaffAccessService;
import jakarta.persistence.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/** Single-person verification requests. A match never writes attendance without teacher approval. */
@Service
public class StudentCheckInService {
    private final StudentCheckInRepository requests;
    private final ClassroomSessionRepository sessions;
    private final CourseEnrollmentRepository enrollments;
    private final AttendanceRecordRepository attendance;
    private final FaceProfileRepository profiles;
    private final VisionService vision;
    private final VisionGateway gateway;
    private final VisionCrypto crypto;
    private final StaffAccessService access;
    private final ObjectMapper json;
    private final EntityManager em;
    private final TransactionTemplate tx;

    public StudentCheckInService(StudentCheckInRepository requests, ClassroomSessionRepository sessions,
            CourseEnrollmentRepository enrollments, AttendanceRecordRepository attendance, FaceProfileRepository profiles,
            VisionService vision, VisionGateway gateway, VisionCrypto crypto, StaffAccessService access,
            ObjectMapper json, EntityManager em, PlatformTransactionManager manager) {
        this.requests = requests; this.sessions = sessions; this.enrollments = enrollments;
        this.attendance = attendance; this.profiles = profiles; this.vision = vision; this.gateway = gateway;
        this.crypto = crypto; this.access = access; this.json = json; this.em = em; this.tx = new TransactionTemplate(manager);
    }

    public record RequestView(UUID id, UUID studentId, String studentName, String state, Instant createdAt,
            Instant expiresAt, Instant reviewedAt) {}
    public record SessionView(UUID sessionId, String course, Instant startTime, Instant endTime, boolean canSubmit,
            String attendanceStatus, RequestView request) {}
    public record Workspace(boolean enabled, boolean ready, List<SessionView> sessions) {}
    public record Decision(boolean teacherConfirmed, String status) {}

    public Workspace workspace(UUID studentId) {
        return tx.execute(s -> {
            eligibleStudent(studentId);
            var p = profiles.findById(studentId).orElse(null);
            boolean ready = p != null && p.active() && p.encryptedTemplates != null;
            if (!gateway.enabled()) return new Workspace(false, ready, List.of());
            Instant now = Instant.now();
            var rows = sessions.findCheckInSessions(studentId, now.minus(1, ChronoUnit.DAYS), now.plus(1, ChronoUnit.DAYS));
            return new Workspace(true, ready, rows.stream().map(session -> {
                var record = attendance.findBySession_IdAndStudent_Id(session.getId(), studentId).orElse(null);
                var latest = requests.findFirstByStudentIdAndSessionIdOrderByCreatedAtDesc(studentId, session.getId()).orElse(null);
                var view = latest == null ? null : view(latest);
                boolean pending = view != null && "PENDING".equals(view.state());
                return new SessionView(session.getId(), session.getCourse(), session.getStartTime(), session.getEndTime(),
                        ready && windowOpen(session) && !pending && unmarked(record), record == null ? "UNKNOWN" : record.getStatus().name(), view);
            }).toList());
        });
    }

    public RequestView submit(UUID studentId, UUID sessionId, UUID key, byte[] image, boolean consent) {
        gateway.requireEnabled(); vision.checkImages(List.of(image));
        if (!consent) throw new ResponseStatusException(BAD_REQUEST, "Confirm consent to submit your own face for this attendance request.");
        String digest = digest(image);
        RequestView previous = tx.execute(s -> {
            membership(studentId, sessionId, false);
            return requests.findByStudentIdAndRequestKey(studentId, key).map(r -> retry(r, sessionId, digest)).orElse(null);
        });
        if (previous != null) return previous;
        VisionService.Snapshot snapshot = tx.execute(s -> {
            membership(studentId, sessionId, true); requireNoPending(studentId, sessionId); requireUnmarked(studentId, sessionId);
            FaceProfile p = profiles.findById(studentId).orElseThrow(() -> conflict("Complete face enrollment with your teacher first."));
            if (!p.active() || p.encryptedTemplates == null) throw conflict("Current consent and face enrollment are required.");
            var subjects = json.createArrayNode();
            subjects.addObject().put("studentId", studentId.toString()).put("modelVersion", p.modelVersion)
                    .set("templates", decode(crypto.decrypt("template:" + studentId, p.encryptedTemplates)));
            var roster = json.createArrayNode();
            roster.addObject().put("studentId", studentId.toString()).put("revision", p.revision.toString())
                    .put("attendanceVersion", vision.attendanceVersion(attendance.findBySession_IdAndStudent_Id(sessionId, studentId).orElse(null)));
            return new VisionService.Snapshot(subjects, roster);
        });
        JsonNode result = vision.infer(() -> gateway.recognize(image, snapshot.subjects().toString()));
        vision.validateRecognition(result, snapshot);
        var faces = result.path("faces");
        if (faces.size() != 1) throw new ResponseStatusException(UNPROCESSABLE_ENTITY, "Capture exactly one face: your own. Try again or ask your teacher for manual attendance.");
        var face = faces.get(0);
        if (!"MATCH_CANDIDATE".equals(face.path("decision").asText()) || face.path("candidates").size() != 1
                || !studentId.toString().equals(face.path("candidates").get(0).path("studentId").asText()))
            throw new ResponseStatusException(UNPROCESSABLE_ENTITY, "Your face could not be verified. Try a clear, well-lit photo or ask your teacher for manual attendance.");
        return tx.execute(s -> {
            lockSession(sessionId);
            membership(studentId, sessionId, true);
            var retry = requests.findByStudentIdAndRequestKey(studentId, key).orElse(null);
            if (retry != null) return retry(retry, sessionId, digest);
            requireNoPending(studentId, sessionId); requireUnmarked(studentId, sessionId);
            vision.validateRoster(sessionId, snapshot.roster());
            var r = new StudentCheckIn(); r.id = UUID.randomUUID(); r.studentId = studentId; r.sessionId = sessionId;
            r.requestKey = key; r.requestDigest = digest; r.state = "PENDING"; r.createdAt = Instant.now();
            r.expiresAt = r.createdAt.plus(30, ChronoUnit.MINUTES);
            var payload = json.createObjectNode(); payload.set("roster", snapshot.roster()); payload.set("recognition", result);
            r.encryptedResult = crypto.encrypt("checkin:" + r.id, payload.toString()); requests.saveAndFlush(r);
            return view(r);
        });
    }

    public List<RequestView> queue(UUID teacherId, UUID sessionId) {
        return tx.execute(s -> {
            access.requireSessionAccess(teacherId, sessionId);
            return requests.findBySessionIdOrderByCreatedAtDesc(sessionId).stream().map(this::view).toList();
        });
    }

    public RequestView decide(UUID teacherId, UUID id, Decision decision) {
        gateway.requireEnabled();
        if (decision == null || !decision.teacherConfirmed() || decision.status() == null
                || !Set.of("PRESENT", "LATE", "REJECTED").contains(decision.status()))
            throw new ResponseStatusException(BAD_REQUEST, "Confirm actual participation and choose Present, Late or Reject.");
        return tx.execute(s -> {
            var r = requests.findById(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Attendance request not found."));
            access.requireSessionAccess(teacherId, r.sessionId);
            var session = lockSession(r.sessionId);
            access.requireSessionAccess(teacherId, r.sessionId);
            // Same lock order as consent/reenrollment: session, student, then request.
            em.find(Student.class, r.studentId, LockModeType.PESSIMISTIC_WRITE);
            em.refresh(r, LockModeType.PESSIMISTIC_WRITE);
            if (!"PENDING".equals(r.state)) {
                if (r.state.equals(decision.status())) return view(r);
                throw conflict("This request was already processed or expired. Refresh the list.");
            }
            if (!r.expiresAt.isAfter(Instant.now()) || r.encryptedResult == null)
                throw new ResponseStatusException(GONE, "This request expired. Ask for a new capture or use manual attendance.");
            if (!"REJECTED".equals(decision.status())) {
                membership(r.studentId, r.sessionId, false);
                if (session.getStatus() == ClassroomSession.SessionStatus.CANCELLED) throw conflict("This session is cancelled.");
                var payload = decode(crypto.decrypt("checkin:" + r.id, r.encryptedResult));
                vision.validateRoster(r.sessionId, payload.path("roster"));
                var record = attendance.findBySession_IdAndStudent_Id(r.sessionId, r.studentId).orElse(null);
                if (!unmarked(record) || !vision.attendanceVersion(record).equals(payload.path("roster").get(0).path("attendanceVersion").asText()))
                    throw conflict("Attendance already exists or changed. Use manual correction instead.");
                if (record == null) record = new AttendanceRecord();
                record.setSession(session); record.setStudent(em.getReference(Student.class, r.studentId));
                record.setStatus(AttendanceRecord.AttendanceStatus.valueOf(decision.status()));
                record.setSource(AttendanceRecord.AttendanceSource.AI); record.setCheckInTime(r.createdAt);
                record.setCheckOutTime(null); record.setAbsenceNote(null); record.setAbsenceReason(null);
                attendance.saveAndFlush(record);
            }
            r.state = decision.status(); r.reviewedBy = teacherId; r.reviewedAt = Instant.now();
            r.encryptedResult = null; requests.save(r);
            return view(r);
        });
    }

    private Student eligibleStudent(UUID id) {
        Student student = em.find(Student.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (student == null) throw new ResponseStatusException(NOT_FOUND, "Student not found.");
        em.refresh(student);
        if (!"ACTIVE".equals(student.getStatus()) || !"APPROVED".equals(student.getApprovalStatus())) throw conflict("An approved, active student account is required.");
        return student;
    }
    private ClassroomSession membership(UUID studentId, UUID sessionId, boolean requireWindow) {
        eligibleStudent(studentId);
        var session = sessions.findById(sessionId).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Session not found."));
        if (session.getCourseOffering() == null) throw new ResponseStatusException(FORBIDDEN, "This session is not available to you.");
        var member = enrollments.findByStudent_IdAndCourseOffering_Id(studentId, session.getCourseOffering().getId())
                .orElseThrow(() -> new ResponseStatusException(FORBIDDEN, "You are not enrolled in this class."));
        em.refresh(member, LockModeType.PESSIMISTIC_READ);
        if (member.getStatus() != CourseEnrollment.EnrollmentStatus.ACTIVE) throw new ResponseStatusException(FORBIDDEN, "Active class enrollment is required.");
        if (requireWindow && !windowOpen(session)) throw conflict("Check-in is open from 15 minutes before class until its end, for scheduled or active sessions.");
        return session;
    }
    private ClassroomSession lockSession(UUID id) {
        var session = em.find(ClassroomSession.class, id);
        if (session == null) throw new ResponseStatusException(NOT_FOUND, "Session not found.");
        em.refresh(session, LockModeType.PESSIMISTIC_WRITE); return session;
    }
    private boolean windowOpen(ClassroomSession session) {
        var now = Instant.now();
        return Set.of(ClassroomSession.SessionStatus.SCHEDULED, ClassroomSession.SessionStatus.ACTIVE).contains(session.getStatus())
                && CheckInSessionTime.withinWindow(session.getStartTime(), session.getEndTime(), now);
    }
    private boolean unmarked(AttendanceRecord record) { return record == null || record.getStatus() == AttendanceRecord.AttendanceStatus.UNKNOWN; }
    private void requireUnmarked(UUID student, UUID session) {
        if (!unmarked(attendance.findBySession_IdAndStudent_Id(session, student).orElse(null))) throw conflict("Attendance is already recorded. Ask your teacher for corrections.");
    }
    private void requireNoPending(UUID student, UUID session) {
        requests.findFirstByStudentIdAndSessionIdOrderByCreatedAtDesc(student, session).ifPresent(r -> {
            if ("PENDING".equals(view(r).state())) throw conflict("A request is already awaiting teacher review.");
        });
    }
    private RequestView retry(StudentCheckIn r, UUID session, String digest) {
        if (!r.sessionId.equals(session) || !r.requestDigest.equals(digest)) throw conflict("Request key was already used for a different capture or session.");
        return view(r);
    }
    private RequestView view(StudentCheckIn r) {
        String state = "PENDING".equals(r.state) && (!r.expiresAt.isAfter(Instant.now()) || r.encryptedResult == null) ? "EXPIRED" : r.state;
        var student = em.find(Student.class, r.studentId);
        return new RequestView(r.id, r.studentId, student.getFullName(), state, r.createdAt, r.expiresAt, r.reviewedAt);
    }
    @Scheduled(fixedDelay = 60000)
    public void purge() {
        tx.executeWithoutResult(s -> {
            for (var r : requests.findByExpiresAtBefore(Instant.now()).stream().sorted(Comparator.comparing(row -> row.id.toString())).toList()) {
                em.refresh(r, LockModeType.PESSIMISTIC_WRITE);
                if (r.createdAt.isBefore(Instant.now().minus(90, ChronoUnit.DAYS))) requests.delete(r);
                else { r.erasePayload(); requests.save(r); }
            }
        });
    }
    private ResponseStatusException conflict(String message) { return new ResponseStatusException(CONFLICT, message); }
    private JsonNode decode(String value) {
        try { return json.readTree(value); } catch (Exception e) { throw new IllegalStateException("Invalid encrypted check-in payload."); }
    }
    private String digest(byte[] image) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(image)); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
}
