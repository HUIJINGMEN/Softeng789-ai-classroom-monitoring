package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.vision.*;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import static org.springframework.http.HttpStatus.*;
import static io.github.huijingmen.softeng789.classroommonitoring.kiosk.KioskProblem.*;
import static io.github.huijingmen.softeng789.classroommonitoring.kiosk.KioskViews.*;

@Service
public class KioskDecisionService {
    private final KioskSessionService sessions;
    private final KioskPayloads payloads;
    private final EntityManager em;
    private final CourseEnrollmentRepository enrollments;
    private final AttendanceRecordRepository attendance;
    private final VisionService vision;
    private final AttendanceReviewHistory history;
    public KioskDecisionService(KioskSessionService sessions, KioskPayloads payloads, EntityManager em, CourseEnrollmentRepository enrollments,
            AttendanceRecordRepository attendance, VisionService vision, AttendanceReviewHistory history) {
        this.sessions = sessions; this.payloads = payloads; this.em = em; this.enrollments = enrollments;
        this.attendance = attendance; this.vision = vision; this.history = history;
    }
    private record Decision(Map<String, Object> body, KioskProblem error) {}
    private KioskAttempt attempt(UUID kiosk, UUID id) {
        var a = em.find(KioskAttempt.class, id);
        if (a == null || !kiosk.equals(a.kioskSessionId)) throw problem(NOT_FOUND, "NOT_FOUND", "Attempt not found.");
        return a;
    }
    public Map<String, Object> confirm(UUID kiosk, UUID id, String candidateId) {
        // Terminal errors must commit their state, erasure and review before being sent as HTTP errors.
        Decision result = sessions.tx.execute(s -> decide(kiosk, id, candidateId));
        if (result.error != null) throw result.error;
        return result.body;
    }
    private Decision decide(UUID kiosk, UUID id, String candidateId) {
        var a = attempt(kiosk, id);
        var c = sessions.classroom(a.sessionId, true);
        em.refresh(a);
        if (!a.open()) return replay(a, candidateId);
        JsonNode candidate = null;
        for (var option : payloads.candidates(a)) if (option.path("candidateId").asText().equals(candidateId)) candidate = option;
        if (candidate == null) throw problem(BAD_REQUEST, "INVALID_CANDIDATE", "Choose one of the candidates from this capture.");
        UUID studentId = UUID.fromString(candidate.path("studentId").asText());
        var student = em.find(Student.class, studentId);
        if (student != null) em.refresh(student, LockModeType.PESSIMISTIC_WRITE);
        var membership = c.getCourseOffering() == null ? null : enrollments
                .findByStudent_IdAndCourseOffering_Id(studentId, c.getCourseOffering().getId()).orElse(null);
        if (membership != null) em.refresh(membership, LockModeType.PESSIMISTIC_READ);
        em.refresh(a, LockModeType.PESSIMISTIC_WRITE);
        if (!a.open()) return replay(a, candidateId);
        var k = sessions.kiosk(kiosk, true);
        a.selectedStudentId = studentId; a.selectedRank = (short) candidate.path("rank").asInt();
        String name = candidate.path("displayName").asText(); a.selectedDisplayName = name;
        Instant now = KioskTime.now(); String state;
        if (!now.isBefore(a.expiresAt)) state = "EXPIRED";
        else if (k.endedAt != null || !now.isBefore(k.expiresAt) || !sessions.eligible(k) || !"OPEN".equals(window(c, now))) state = "SESSION_CLOSED";
        else if (student == null || !"ACTIVE".equals(student.getStatus()) || !"APPROVED".equals(student.getApprovalStatus())
                || membership == null || membership.getStatus() != CourseEnrollment.EnrollmentStatus.ACTIVE) state = "BLOCKED_NOT_ENROLLED";
        else if (!vision.kioskProfileMatches(studentId, candidate.path("revision").asText())) state = "STALE";
        else {
            var record = attendance.findBySession_IdAndStudent_Id(a.sessionId, studentId).orElse(null);
            if (record != null && record.getStatus() == AttendanceRecord.AttendanceStatus.ABSENT) state = "ATTENDANCE_LOCKED";
            else if (record != null && Set.of(AttendanceRecord.AttendanceStatus.PRESENT, AttendanceRecord.AttendanceStatus.LATE).contains(record.getStatus())) {
                state = "ALREADY_RECORDED"; a.attendanceStatus = record.getStatus().name();
            } else {
                a.attendanceStatus = k.lateAfterMinutes != null && a.capturedAt.isAfter(c.getStartTime().plusSeconds(k.lateAfterMinutes * 60L)) ? "LATE" : "PRESENT";
                if (record == null) record = new AttendanceRecord();
                record.setSession(c); record.setStudent(student); record.setStatus(AttendanceRecord.AttendanceStatus.valueOf(a.attendanceStatus));
                record.setSource(AttendanceRecord.AttendanceSource.KIOSK); record.setCheckInTime(a.capturedAt);
                record.setCheckOutTime(null); record.setAbsenceReason(null); record.setAbsenceNote(null);
                attendance.saveAndFlush(record);
                history.record(a.sessionId, studentId, null, "KIOSK_SELF_CONFIRMED", "UNKNOWN", a.attendanceStatus);
                state = "CONFIRMED";
            }
        }
        payloads.finish(a, state);
        return outcome(a, name, false);
    }
    private Decision replay(KioskAttempt a, String candidate) {
        if ("EXPIRED".equals(a.state)) return outcome(a, a.selectedDisplayName, true);
        if (a.selectedRank == null || !("c" + a.selectedRank).equals(candidate))
            throw problem(CONFLICT, "ATTEMPT_FINALIZED", "This attempt has already been finalized.");
        return outcome(a, a.selectedDisplayName, true);
    }
    private Decision outcome(KioskAttempt a, String name, boolean replayed) {
        KioskProblem error = switch (a.state) {
            case "EXPIRED" -> problem(GONE, "ATTEMPT_EXPIRED", "This attempt has expired. Capture a new photo.");
            case "SESSION_CLOSED" -> problem(CONFLICT, "KIOSK_SESSION_CLOSED", "This class session is closed.");
            case "BLOCKED_NOT_ENROLLED" -> problem(FORBIDDEN, "NOT_ENROLLED", "Active, approved class enrollment is required.");
            case "STALE" -> problem(CONFLICT, "CANDIDATES_STALE", "Face consent or enrollment changed. Capture a new photo.");
            case "ATTENDANCE_LOCKED" -> problem(CONFLICT, "ATTENDANCE_LOCKED", "Attendance is locked. Ask a staff member to review it.");
            case "CONFIRMED", "ALREADY_RECORDED" -> null;
            default -> problem(CONFLICT, "ATTEMPT_FINALIZED", "This attempt has already been finalized.");
        };
        return new Decision(error == null ? fields("attemptId", a.id, "result", a.state, "attendanceStatus", a.attendanceStatus,
                "displayName", name, "processedAt", a.processedAt, "replayed", replayed) : null, error);
    }
    public void cancel(UUID kiosk, UUID id, String reason) {
        if (reason == null || !Set.of("NOT_LISTED", "TIMEOUT").contains(reason))
            throw problem(BAD_REQUEST, "VALIDATION_FAILED", "Choose NOT_LISTED or TIMEOUT.");
        sessions.tx.executeWithoutResult(s -> {
            var a = attempt(kiosk, id); sessions.classroom(a.sessionId, true); em.refresh(a, LockModeType.PESSIMISTIC_WRITE);
            if (a.open()) payloads.finish(a, "CANCELLED_" + reason);
        });
    }
}
