package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AuthResponse;
import io.github.huijingmen.softeng789.classroommonitoring.auth.LoginSession;
import io.github.huijingmen.softeng789.classroommonitoring.auth.LoginSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

/**
 * Owns the durable login-session store and every "who is allowed to do this" gate
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

    public static final Duration TOKEN_TTL = Duration.ofHours(12);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final LoginSessionRepository sessions;
    private final StudentRepository students;
    private final TeacherRepository teachers;

    public record Principal(String role, UUID id, String approvalStatus) {
    }

    public SessionAuthService(LoginSessionRepository sessions, StudentRepository students, TeacherRepository teachers) {
        this.sessions = sessions;
        this.students = students;
        this.teachers = teachers;
    }

    public AuthResponse issueToken(String role, UUID id, String name, String email, String approvalStatus) {
        Instant now = Instant.now();
        sessions.deleteExpired(now);

        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.saveAndFlush(new LoginSession(digest(token), id, role, now, now.plus(TOKEN_TTL)));
        return new AuthResponse(token, role, id, name, email, approvalStatus);
    }

    public void logout(String token) {
        if (token != null) sessions.deleteById(digest(token));
    }

    /** Durable account-wide revocation, including other devices and application instances. */
    public void revokeSessionsFor(UUID id) {
        sessions.revokeAccount(id);
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

    /** Parses the server-only adapter header. BrowserSessionFilter never accepts a public Bearer header. */
    public String extractToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(UNAUTHORIZED, "Sign in required.");
        }
        return authorizationHeader.substring("Bearer ".length()).trim();
    }

    /** Rechecks durable expiry and current account eligibility on every resolution. */
    public Principal resolve(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) return null;
        LoginSession session = sessions.findById(digest(token)).orElse(null);
        if (session == null) {
            return null;
        }
        if (!Instant.now().isBefore(session.getExpiresAt())) {
            return null;
        }
        Principal principal = currentPrincipal(session);
        if (principal == null) sessions.revokeCredential(session.getCredentialDigest());
        return principal;
    }

    private Principal currentPrincipal(LoginSession session) {
        if (ROLE_STUDENT.equals(session.getRole())) {
            return students.findById(session.getAccountId()).filter(student -> "ACTIVE".equals(student.getStatus()))
                    .map(student -> new Principal(ROLE_STUDENT, student.getId(), student.getApprovalStatus())).orElse(null);
        }
        return teachers.findById(session.getAccountId())
                .filter(teacher -> "ACTIVE".equals(teacher.getStatus()) && session.getRole().equals(teacher.getRole()))
                .map(teacher -> new Principal(teacher.getRole(), teacher.getId(), "APPROVED")).orElse(null);
    }

    private static String digest(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required for session storage.", exception);
        }
    }
}
