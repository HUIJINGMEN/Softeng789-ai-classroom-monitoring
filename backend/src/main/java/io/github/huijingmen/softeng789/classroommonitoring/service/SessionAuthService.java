package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AuthResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

/**
 * Owns the in-memory bearer-token session store and every "who is allowed to do this" gate
 * method — split out of {@link AuthService}, which now only handles registration/login/whoami.
 * Nearly every controller in the app depends only on the gate methods here (requireTeacher/
 * requireAdmin/requireSelfOrTeacher); AuthService itself depends on this class (for issueToken/
 * logout/resolve), not the other way round.
 */
@Service
public class SessionAuthService {
    public static final String ROLE_STUDENT = "STUDENT";
    public static final String ROLE_TEACHER = "TEACHER";
    public static final String ROLE_ADMIN = "ADMIN";

    private static final Duration TOKEN_TTL = Duration.ofHours(12);

    private final Map<String, Session> sessions = new ConcurrentHashMap<>();

    record Principal(String role, UUID id) {
    }

    private record Session(Principal principal, Instant expiresAt) {
    }

    public AuthResponse issueToken(String role, UUID id, String name, String email, String approvalStatus) {
        Instant now = Instant.now();
        sessions.entrySet().removeIf(entry -> now.isAfter(entry.getValue().expiresAt()));

        String token = UUID.randomUUID().toString();
        sessions.put(token, new Session(new Principal(role, id), now.plus(TOKEN_TTL)));
        return new AuthResponse(token, role, id, name, email, approvalStatus);
    }

    public void logout(String token) {
        sessions.remove(token);
    }

    /** Immediately invalidates every live session for this staff member, on all devices/tabs —
     *  called right after an admin deactivates them, since tokens are opaque and stateful (see
     *  AuthService's class-level note) rather than self-verifying, so nothing short of removing
     *  the session entry itself stops them being used for the rest of the token's TTL. */
    public void revokeSessionsFor(UUID id) {
        sessions.entrySet().removeIf(entry -> entry.getValue().principal().id().equals(id));
    }

    /** Allows a teacher (or admin) to access any student's records, or a student to access only their own. */
    public Optional<UUID> requireSelfOrTeacher(String authorizationHeader, UUID studentId) {
        Principal principal = resolvePrincipalOrThrow(authorizationHeader);
        if (isStaff(principal)) {
            return Optional.of(principal.id());
        }
        if (principal.role().equals(ROLE_STUDENT) && principal.id().equals(studentId)) {
            return Optional.empty();
        }
        throw new ResponseStatusException(FORBIDDEN, "You can only access your own records.");
    }

    /** Allows only the signed-in student whose id appears in the route. This is intentionally
     * stricter than requireSelfOrTeacher: student-facing endpoints must not become a back door
     * around the per-class scoping applied to ordinary teachers elsewhere in the console. */
    public UUID requireStudentSelf(String authorizationHeader, UUID studentId) {
        Principal principal = resolvePrincipalOrThrow(authorizationHeader);
        if (principal.role().equals(ROLE_STUDENT) && principal.id().equals(studentId)) {
            return principal.id();
        }
        throw new ResponseStatusException(FORBIDDEN, "You can only access your own student portal.");
    }

    /** Gates teacher-console-only endpoints (roster management, session lifecycle, attendance
     *  edits). Returns the acting staff member's own id — needed by endpoints (like reporting or
     *  resolving a health alert) that record who performed the action. */
    public UUID requireTeacher(String authorizationHeader) {
        Principal principal = resolvePrincipalOrThrow(authorizationHeader);
        if (!isStaff(principal)) {
            throw new ResponseStatusException(FORBIDDEN, "Only teachers can do this.");
        }
        return principal.id();
    }

    /** Gates admin-only endpoints (managing the teacher/admin list, creating students). Returns the
     *  acting admin's own id — needed by endpoints like staff deactivation that must tell whether
     *  the admin is targeting their own account. */
    public UUID requireAdmin(String authorizationHeader) {
        Principal principal = resolvePrincipalOrThrow(authorizationHeader);
        if (!principal.role().equals(ROLE_ADMIN)) {
            throw new ResponseStatusException(FORBIDDEN, "Only admins can do this.");
        }
        return principal.id();
    }

    /** An admin can do everything a teacher can — it's a strictly higher-privileged staff role. */
    private boolean isStaff(Principal principal) {
        return principal.role().equals(ROLE_TEACHER) || principal.role().equals(ROLE_ADMIN);
    }

    /** Shared by requireSelfOrTeacher/requireTeacher/requireAdmin: resolve the token, or 401 if
     *  it's missing/invalid. */
    private Principal resolvePrincipalOrThrow(String authorizationHeader) {
        Principal principal = resolve(extractToken(authorizationHeader));
        if (principal == null) {
            throw new ResponseStatusException(UNAUTHORIZED, "Sign in required.");
        }
        return principal;
    }

    /** Shared bearer-token parsing so controllers don't each reimplement it. */
    public String extractToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(UNAUTHORIZED, "Sign in required.");
        }
        return authorizationHeader.substring("Bearer ".length()).trim();
    }

    /** Bare-token resolution (nullable, non-throwing) — used directly by AuthService.me(), which
     *  wants its own "session expired" message rather than resolvePrincipalOrThrow's generic one. */
    Principal resolve(String token) {
        Session session = sessions.get(token);
        if (session == null) {
            return null;
        }
        if (Instant.now().isAfter(session.expiresAt())) {
            sessions.remove(token);
            return null;
        }
        return session.principal();
    }
}
