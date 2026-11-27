package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.vision.VisionCrypto;
import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import static org.springframework.http.HttpStatus.*;
import static io.github.huijingmen.softeng789.classroommonitoring.kiosk.KioskProblem.*;
import static io.github.huijingmen.softeng789.classroommonitoring.kiosk.KioskViews.*;

@Service
public class KioskReviewService {
    private final KioskSessionService sessions;
    private final EntityManager em;
    private final VisionCrypto crypto;
    public KioskReviewService(KioskSessionService sessions, EntityManager em, VisionCrypto crypto) {
        this.sessions = sessions; this.em = em; this.crypto = crypto;
    }
    static PageRequest page(int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE)
            throw problem(BAD_REQUEST, "VALIDATION_FAILED", "Choose a valid page and a size from 1 to 100.");
        return PageRequest.of(page, size);
    }
    public PageResponse<Map<String, Object>> attempts(UUID staff, UUID session, int page, int size) {
        var paging = page(page, size);
        return sessions.tx.execute(s -> {
            sessions.requireAccess(staff, session);
            var rows = em.createQuery("select a from KioskAttempt a where a.sessionId = :id order by a.capturedAt desc, a.id desc", KioskAttempt.class)
                    .setParameter("id", session).setFirstResult((int) paging.getOffset()).setMaxResults(size).getResultList();
            var total = em.createQuery("select count(a) from KioskAttempt a where a.sessionId = :id", Long.class).setParameter("id", session).getSingleResult();
            return PageResponse.from(new PageImpl<>(rows, paging, total), a -> {
                var reviews = em.createQuery("select r from KioskReviewItem r where r.attemptId = :id", KioskReviewItem.class)
                        .setParameter("id", a.id).getResultList();
                return fields("attemptId", a.id, "capturedAt", a.capturedAt, "processedAt", a.processedAt,
                        "state", a.state, "locationLabel", a.locationLabel, "campusName", sessions.campusName(a.campusId),
                        "student", student(a.selectedStudentId, false), "selectedRank", a.selectedRank, "attendanceStatus", a.attendanceStatus,
                        "reviewKind", reviews.isEmpty() ? null : reviews.getFirst().kind);
            });
        });
    }
    public PageResponse<Map<String, Object>> reviews(String state, int page, int size) {
        if (state == null || !Set.of("OPEN", "RESOLVED", "ALL").contains(state))
            throw problem(BAD_REQUEST, "VALIDATION_FAILED", "Choose OPEN, RESOLVED or ALL.");
        var paging = page(page, size);
        return sessions.tx.execute(s -> {
            String where = "ALL".equals(state) ? "" : " where r.state = :state";
            var query = em.createQuery("select r from KioskReviewItem r" + where + " order by r.createdAt desc, r.id desc", KioskReviewItem.class);
            var count = em.createQuery("select count(r) from KioskReviewItem r" + where, Long.class);
            if (!"ALL".equals(state)) { query.setParameter("state", state); count.setParameter("state", state); }
            var rows = query.setFirstResult((int) paging.getOffset()).setMaxResults(size).getResultList();
            return PageResponse.from(new PageImpl<>(rows, paging, count.getSingleResult()), this::view);
        });
    }
    public Map<String, Object> summary() {
        return sessions.tx.execute(s -> fields("open", em.createQuery("select count(r) from KioskReviewItem r where r.state = 'OPEN'", Long.class).getSingleResult()));
    }
    KioskReviewItem find(UUID id, boolean lock) {
        var r = em.find(KioskReviewItem.class, id);
        if (r == null) throw problem(NOT_FOUND, "NOT_FOUND", "Review item not found.");
        if (lock) em.refresh(r, LockModeType.PESSIMISTIC_WRITE);
        return r;
    }
    Object student(UUID id, boolean number) {
        var student = id == null ? null : em.find(Student.class, id);
        if (student == null) return null;
        return number ? fields("id", id, "name", student.getFullName(), "studentNumber", student.getStudentNumber())
                : fields("id", id, "name", student.getFullName());
    }
    Map<String, Object> view(KioskReviewItem r) {
        var a = em.find(KioskAttempt.class, r.attemptId);
        var c = sessions.classroom(a.sessionId, false);
        var e = em.find(KioskEvidence.class, a.id);
        boolean available = e != null && KioskTime.now().isBefore(e.deleteAfter);
        return fields("id", r.id, "kind", r.kind, "state", r.state, "createdAt", r.createdAt, "attemptId", a.id,
                "selectedRank", a.selectedRank, "selectedStudent", student(a.selectedStudentId, true), "topCandidate", student(a.topStudentId, true),
                "session", fields("id", c.getId(), "classLabel", label(c), "startTime", c.getStartTime()),
                "campusName", sessions.campusName(a.campusId), "locationLabel", a.locationLabel, "capturedAt", a.capturedAt,
                "processedAt", a.processedAt, "attemptResult", a.state, "attendanceStatus", a.attendanceStatus,
                "evidenceAvailable", available, "evidenceDeleteAfter", e == null ? null : e.deleteAfter, "resolution", r.resolution,
                "note", r.note, "resolvedByName", sessions.staffName(r.resolvedBy), "resolvedAt", r.resolvedAt);
    }
    public record Evidence(byte[] bytes, String contentType) {
        @Override public String toString() { return "[redacted kiosk evidence]"; }
    }
    public Evidence evidence(UUID id) {
        return sessions.tx.execute(s -> {
            var r = find(id, false);
            var e = em.find(KioskEvidence.class, r.attemptId, LockModeType.PESSIMISTIC_READ);
            if (e == null || !KioskTime.now().isBefore(e.deleteAfter)) throw problem(GONE, "EVIDENCE_EXPIRED", "The capture evidence has expired.");
            return new Evidence(Base64.getDecoder().decode(crypto.decrypt("kiosk-evidence:" + e.attemptId, e.encryptedImage)), e.contentType);
        });
    }
    public record Resolve(String resolution, String note) {
        @Override public String toString() { return "[redacted kiosk resolution]"; }
    }
    public Map<String, Object> resolve(UUID admin, UUID id, Resolve request) {
        if (request == null || request.resolution() == null || !Set.of("VERIFIED_CORRECT", "ATTENDANCE_CORRECTED", "NO_ACTION").contains(request.resolution())
                || request.note() != null && request.note().length() > 500)
            throw problem(BAD_REQUEST, "VALIDATION_FAILED", "Choose a valid resolution and a note of at most 500 characters.");
        return sessions.tx.execute(s -> {
            var r = find(id, true);
            if ("RESOLVED".equals(r.state)) {
                if (!request.resolution().equals(r.resolution)) throw problem(CONFLICT, "REVIEW_ALREADY_RESOLVED", "This item already has a different resolution.");
                return view(r);
            }
            r.state = "RESOLVED"; r.resolution = request.resolution(); r.note = request.note(); r.resolvedBy = admin; r.resolvedAt = KioskTime.now();
            return view(r);
        });
    }
}
