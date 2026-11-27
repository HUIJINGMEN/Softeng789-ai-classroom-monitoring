package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import io.github.huijingmen.softeng789.classroommonitoring.auth.LoginSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.*;
import io.github.huijingmen.softeng789.classroommonitoring.vision.*;
import jakarta.persistence.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static io.github.huijingmen.softeng789.classroommonitoring.kiosk.KioskProblem.*;
import static io.github.huijingmen.softeng789.classroommonitoring.kiosk.KioskViews.*;

@Service
public class KioskSessionService {
    final EntityManager em;
    final TransactionTemplate tx;
    private final StaffAccessService access;
    private final LoginSessionRepository logins;
    private final CourseEnrollmentRepository enrollments;
    private final TransactionTemplate reads;
    private final VisionGateway gateway;
    private final VisionService vision;
    private final TeacherScopeSupport scope;

    public KioskSessionService(EntityManager em, PlatformTransactionManager manager, StaffAccessService access,
            LoginSessionRepository logins, CourseEnrollmentRepository enrollments, VisionGateway gateway, TeacherScopeSupport scope, VisionService vision) {
        this.em = em; this.tx = new TransactionTemplate(manager); this.access = access;
        this.logins = logins; this.enrollments = enrollments; this.gateway = gateway; this.scope = scope;
        this.vision = vision;
        this.reads = new TransactionTemplate(manager); this.reads.setReadOnly(true);
    }
    public record Launch(UUID sessionId, UUID campusId, String locationLabel, Integer lateAfterMinutes, Boolean deviceConfirmed) {}

    void requireAccess(UUID staff, UUID session) {
        try { access.requireSessionAccess(staff, session); }
        catch (ResponseStatusException e) {
            throw problem(e.getStatusCode().value() == 404 ? NOT_FOUND : FORBIDDEN,
                    e.getStatusCode().value() == 404 ? "NOT_FOUND" : "ACCESS_DENIED", "This class is not available to you.");
        }
    }
    ClassroomSession classroom(UUID id, boolean lock) {
        var session = em.find(ClassroomSession.class, id);
        if (session == null) throw problem(NOT_FOUND, "NOT_FOUND", "Class session not found.");
        if (lock) em.refresh(session, LockModeType.PESSIMISTIC_WRITE);
        return session;
    }
    KioskSession kiosk(UUID id, boolean lock) {
        var kiosk = em.find(KioskSession.class, id);
        if (kiosk == null) throw new ResponseStatusException(UNAUTHORIZED, "Sign in required.");
        if (lock) em.refresh(kiosk, LockModeType.PESSIMISTIC_WRITE);
        return kiosk;
    }
    private boolean canAccess(UUID staff, ClassroomSession classroom) {
        if (staff == null) return false;
        try {
            var caller = scope.requireCaller(staff);
            return !scope.bindSessionAccess(em.createQuery("select c.id from ClassroomSession c where c.id = :id and "
                    + scope.sessionAccessPredicate("c"), UUID.class).setParameter("id", classroom.getId()), caller)
                    .getResultList().isEmpty();
        } catch (ResponseStatusException e) { return false; }
    }
    boolean eligible(KioskSession kiosk) { return canAccess(kiosk.launchedBy, classroom(kiosk.sessionId, false)); }
    /** Called before any domain gate accepts the cookie; revocation is durable. */
    public boolean resolve(UUID id) {
        boolean valid = Boolean.TRUE.equals(reads.execute(s -> {
            var k = em.find(KioskSession.class, id);
            return k != null && k.endedAt == null && KioskTime.now().isBefore(k.expiresAt) && eligible(k);
        }));
        if (valid) return true;
        // Invalid identities alone need a lock, and are rechecked after acquiring it.
        return Boolean.TRUE.equals(tx.execute(s -> {
            var k = em.find(KioskSession.class, id);
            if (k == null) return false;
            em.refresh(k, LockModeType.PESSIMISTIC_WRITE);
            if (k.endedAt != null) return false;
            if (!KioskTime.now().isBefore(k.expiresAt)) { end(k, null, "EXPIRED"); return false; }
            if (!eligible(k)) { end(k, null, "ACCESS_LOST"); return false; }
            return true;
        }));
    }
    void requireActive(KioskSession k) {
        if (k.endedAt != null || !KioskTime.now().isBefore(k.expiresAt) || !eligible(k))
            throw new ResponseStatusException(UNAUTHORIZED, "Sign in required.");
    }
    void end(KioskSession k, UUID staff, String reason) {
        KioskRequestAuthentication.invalidate();
        if (k.endedAt != null) return;
        k.endedAt = KioskTime.now(); k.endedBy = staff; k.endReason = reason;
        logins.revokeAccount(k.id);
    }
    public void exit(UUID id) {
        tx.executeWithoutResult(s -> { var k = em.find(KioskSession.class, id);
            if (k != null) { em.refresh(k, LockModeType.PESSIMISTIC_WRITE); end(k, null, "DEVICE_EXIT"); }
        });
    }
    public void end(UUID staff, UUID id) {
        tx.executeWithoutResult(s -> {
            var k = em.find(KioskSession.class, id);
            if (k == null) throw problem(NOT_FOUND, "NOT_FOUND", "Kiosk session not found.");
            if (!staff.equals(k.launchedBy)) requireAccess(staff, k.sessionId);
            em.refresh(k, LockModeType.PESSIMISTIC_WRITE); end(k, staff, "STAFF_ENDED");
        });
    }
    public String location(UUID id) { return tx.execute(s -> kiosk(id, false).locationLabel); }
    public Instant expiry(UUID id) { return tx.execute(s -> kiosk(id, false).expiresAt); }

    List<Student> roster(ClassroomSession session) {
        if (session.getCourseOffering() == null) return List.of();
        return enrollments.findByCourseOffering_IdAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
                session.getCourseOffering().getId(), CourseEnrollment.EnrollmentStatus.ACTIVE).stream()
                .map(CourseEnrollment::getStudent).filter(st -> "ACTIVE".equals(st.getStatus()) && "APPROVED".equals(st.getApprovalStatus())).toList();
    }
    String blockedReason(ClassroomSession session, int size, long ready) {
        Instant now = KioskTime.now();
        if (session.getStatus() == ClassroomSession.SessionStatus.CANCELLED) return "CANCELLED";
        if (!now.isBefore(session.getEndTime()) || session.getStatus() == ClassroomSession.SessionStatus.COMPLETED
                || session.getDate().isBefore(now.atZone(SessionClock.AUCKLAND).toLocalDate())) return "WINDOW_CLOSED";
        if (now.isBefore(session.getStartTime().minusSeconds(7200))) return "TOO_EARLY";
        if (session.getCourseOffering() == null) return "NO_CLASS";
        if (size > 30) return "ROSTER_TOO_LARGE";
        if (!gateway.enabled()) return "RECOGNITION_DISABLED";
        return ready == 0 ? "NO_FACE_READY_STUDENTS" : null;
    }
    private Set<UUID> readyIds(Collection<UUID> students) {
        return vision.faceReadyStudentIds(students);
    }
    long ready(List<Student> roster) { return readyIds(roster.stream().map(Student::getId).toList()).size(); }

    public Map<String, Object> options(UUID staff, LocalDate date, UUID campus) {
        return reads.execute(s -> {
            var caller = scope.requireCaller(staff);
            var campuses = em.createQuery("select c from Campus c order by c.name", Campus.class).getResultList()
                    .stream().map(c -> fields("id", c.getId(), "name", c.getName())).toList();
            var selected = scope.bindSessionAccess(em.createQuery("select distinct s from ClassroomSession s "
                    + "left join fetch s.courseOffering o left join fetch o.teachers "
                    + "left join fetch s.teacher left join fetch s.roomEntity r left join fetch r.campus "
                    + "where s.date = :date and " + scope.sessionAccessPredicate("s")
                    + " order by s.startTime, s.id", ClassroomSession.class)
                    .setParameter("date", date), caller).getResultList().stream()
                    .filter(session -> campus == null || session.getRoomEntity() == null
                            || campus.equals(session.getRoomEntity().getCampus().getId())).toList();
            var offeringIds = selected.stream().filter(c -> c.getCourseOffering() != null)
                    .map(c -> c.getCourseOffering().getId()).distinct().toList();
            var rosters = new HashMap<UUID, List<Student>>();
            if (!offeringIds.isEmpty()) for (var member : em.createQuery(
                    "select e from CourseEnrollment e join fetch e.student st join fetch e.courseOffering o "
                    + "where o.id in :ids and e.status = :active and st.status = 'ACTIVE' and st.approvalStatus = 'APPROVED'", CourseEnrollment.class)
                    .setParameter("ids", offeringIds).setParameter("active", CourseEnrollment.EnrollmentStatus.ACTIVE).getResultList())
                rosters.computeIfAbsent(member.getCourseOffering().getId(), ignored -> new ArrayList<>()).add(member.getStudent());
            var faceReady = readyIds(rosters.values().stream().flatMap(List::stream).map(Student::getId).distinct().toList());
            var rows = new ArrayList<Map<String, Object>>();
            for (var session : selected) {
                var room = session.getRoomEntity();
                UUID roomCampus = room == null ? null : room.getCampus().getId();
                var roster = session.getCourseOffering() == null ? List.<Student>of()
                        : rosters.getOrDefault(session.getCourseOffering().getId(), List.of());
                long ready = roster.stream().filter(st -> faceReady.contains(st.getId())).count();
                String blocked = blockedReason(session, roster.size(), ready);
                rows.add(fields("sessionId", session.getId(), "offeringId", session.getCourseOffering() == null ? null : session.getCourseOffering().getId(),
                        "classLabel", label(session), "course", session.getCourse(), "campusId", roomCampus,
                        "roomName", room == null ? null : room.getName(), "startTime", session.getStartTime(), "endTime", session.getEndTime(),
                        "status", session.getStatus(), "launchable", blocked == null, "blockedReason", blocked, "rosterSize", roster.size(), "faceReadyCount", ready));
            }
            List<String> recent = List.of();
            if (campus != null) {
                recent = scope.bindSessionAccess(em.createQuery(
                        "select k.locationLabel from KioskSession k join ClassroomSession c on c.id = k.sessionId "
                        + "where k.campusId = :campus and " + scope.sessionAccessPredicate("c")
                        + " group by k.locationLabel order by max(k.launchedAt) desc, k.locationLabel", String.class)
                        .setParameter("campus", campus).setMaxResults(10), caller).getResultList();
            }
            return fields("date", date, "timeZone", SessionClock.AUCKLAND.getId(), "campuses", campuses, "sessions", rows, "recentLocations", recent);
        });
    }

    /** Caller wraps launch and credential replacement in this same transaction. */
    KioskSession launch(UUID staff, Launch request) {
        if (request == null || request.sessionId() == null || request.campusId() == null || !Boolean.TRUE.equals(request.deviceConfirmed())
                || request.locationLabel() == null || request.locationLabel().codePoints().anyMatch(Character::isISOControl)
                || request.locationLabel().trim().length() < 2 || request.locationLabel().trim().length() > 80
                || request.lateAfterMinutes() != null && (request.lateAfterMinutes() < 0 || request.lateAfterMinutes() > 60))
            throw problem(BAD_REQUEST, "VALIDATION_FAILED", "Confirm the device and provide a valid location and late threshold.");
        requireAccess(staff, request.sessionId());
        var session = classroom(request.sessionId(), true);
        var campus = em.find(Campus.class, request.campusId());
        if (campus == null) throw problem(NOT_FOUND, "NOT_FOUND", "Campus not found.");
        em.refresh(campus, LockModeType.PESSIMISTIC_READ);
        if (session.getRoomEntity() != null && !campus.getId().equals(session.getRoomEntity().getCampus().getId()))
            throw problem(BAD_REQUEST, "VALIDATION_FAILED", "The kiosk campus must match the classroom campus.");
        var roster = roster(session); String reason = blockedReason(session, roster.size(), ready(roster));
        if ("RECOGNITION_DISABLED".equals(reason)) throw problem(SERVICE_UNAVAILABLE, "RECOGNITION_UNAVAILABLE", "Face recognition is unavailable.");
        if (reason != null) throw blocked(reason);
        var k = new KioskSession(); k.id = UUID.randomUUID(); k.sessionId = session.getId(); k.campusId = campus.getId();
        k.locationLabel = request.locationLabel().trim(); k.lateAfterMinutes = request.lateAfterMinutes(); k.launchedBy = staff; k.launchedAt = KioskTime.now();
        k.expiresAt = session.getEndTime().plusSeconds(600).isBefore(k.launchedAt.plusSeconds(43200))
                ? session.getEndTime().plusSeconds(600) : k.launchedAt.plusSeconds(43200);
        em.persist(k); return k;
    }
    Map<String, Object> launchView(KioskSession k) {
        var c = classroom(k.sessionId, false);
        return fields("kioskSessionId", k.id, "sessionId", k.sessionId, "classLabel", label(c), "campusName", campusName(k.campusId),
                "locationLabel", k.locationLabel, "lateAfterMinutes", k.lateAfterMinutes, "opensAt", c.getStartTime().minusSeconds(900),
                "closesAt", c.getEndTime(), "expiresAt", k.expiresAt);
    }
    String campusName(UUID id) { var c = em.find(Campus.class, id); return c == null ? null : c.getName(); }
    String staffName(UUID id) { var t = id == null ? null : em.find(Teacher.class, id); return t == null ? null : t.getName(); }
    public Map<String, Object> device(UUID id) {
        return tx.execute(s -> {
            var k = kiosk(id, false); requireActive(k); var c = classroom(k.sessionId, false); var now = KioskTime.now();
            return fields("kioskSessionId", k.id, "classLabel", label(c), "course", c.getCourse(), "campusName", campusName(k.campusId),
                    "locationLabel", k.locationLabel, "startTime", c.getStartTime(), "endTime", c.getEndTime(),
                    "opensAt", c.getStartTime().minusSeconds(900), "closesAt", c.getEndTime(), "windowState", window(c, now),
                    "serverTime", now, "captureCooldownMs", 2000, "attemptTtlSeconds", 120, "maxImageBytes", 2097152);
        });
    }
    public List<Map<String, Object>> list(UUID staff, UUID sessionId) {
        return tx.execute(s -> {
            requireAccess(staff, sessionId);
            return em.createQuery("select k from KioskSession k where k.sessionId = :id order by k.launchedAt desc", KioskSession.class)
                    .setParameter("id", sessionId).getResultList().stream().map(k -> fields(
                        "kioskSessionId", k.id, "locationLabel", k.locationLabel, "campusName", campusName(k.campusId),
                        "launchedByName", staffName(k.launchedBy), "launchedAt", k.launchedAt, "expiresAt", k.expiresAt,
                        "endedAt", k.endedAt, "endReason", k.endReason, "confirmedCount", em.createQuery(
                            "select count(a) from KioskAttempt a where a.kioskSessionId = :id and a.state = 'CONFIRMED'", Long.class)
                            .setParameter("id", k.id).getSingleResult())).toList();
        });
    }
}
