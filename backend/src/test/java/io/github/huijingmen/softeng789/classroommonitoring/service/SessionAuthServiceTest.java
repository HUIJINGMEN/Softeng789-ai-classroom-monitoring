package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AuthResponse;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * These gate methods (requireTeacher/requireAdmin/requireSelfOrTeacher) previously lived on
 * AuthService and had zero direct test coverage of their own — every existing AuthServiceTest
 * exercises them only indirectly through login/me. This fills that gap now that they're split
 * out into their own class.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:session-auth-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class SessionAuthServiceTest {
    @Autowired
    private SessionAuthService sessionAuthService;

    private String bearerFor(String role) {
        AuthResponse response = sessionAuthService.issueToken(role, UUID.randomUUID(), "Test User",
                "test@example.com", "APPROVED");
        return "Bearer " + response.token();
    }

    @Test
    void requireTeacherAcceptsATeacherToken() {
        String header = bearerFor(SessionAuthService.ROLE_TEACHER);

        assertThat(sessionAuthService.requireTeacher(header)).isNotNull();
    }

    @Test
    void requireTeacherAcceptsAnAdminTokenTooSinceAdminIsAHigherPrivilegedStaffRole() {
        String header = bearerFor(SessionAuthService.ROLE_ADMIN);

        assertThat(sessionAuthService.requireTeacher(header)).isNotNull();
    }

    @Test
    void requireTeacherRejectsAStudentToken() {
        String header = bearerFor(SessionAuthService.ROLE_STUDENT);

        assertThatThrownBy(() -> sessionAuthService.requireTeacher(header))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Only teachers");
    }

    @Test
    void requireTeacherRejectsAMissingAuthorizationHeader() {
        assertThatThrownBy(() -> sessionAuthService.requireTeacher(null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Sign in required");
    }

    @Test
    void requireTeacherRejectsAMalformedHeaderMissingTheBearerPrefix() {
        assertThatThrownBy(() -> sessionAuthService.requireTeacher("not-a-bearer-token"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Sign in required");
    }

    @Test
    void requireTeacherRejectsAnUnknownToken() {
        assertThatThrownBy(() -> sessionAuthService.requireTeacher("Bearer " + UUID.randomUUID()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Sign in required");
    }

    @Test
    void requireAdminAcceptsAnAdminToken() {
        String header = bearerFor(SessionAuthService.ROLE_ADMIN);

        assertThat(sessionAuthService.requireAdmin(header)).isNotNull();
    }

    @Test
    void requireAdminRejectsAPlainTeacherToken() {
        String header = bearerFor(SessionAuthService.ROLE_TEACHER);

        assertThatThrownBy(() -> sessionAuthService.requireAdmin(header))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Only admins");
    }

    @Test
    void requireSelfOrTeacherAllowsAStudentToAccessTheirOwnRecords() {
        AuthResponse response = sessionAuthService.issueToken(SessionAuthService.ROLE_STUDENT, UUID.randomUUID(),
                "Test Student", "student@example.com", "APPROVED");
        String header = "Bearer " + response.token();

        sessionAuthService.requireSelfOrTeacher(header, response.id());
        // No exception thrown = success.
    }

    @Test
    void requireSelfOrTeacherRejectsAStudentAccessingSomeoneElsesRecords() {
        String header = bearerFor(SessionAuthService.ROLE_STUDENT);

        assertThatThrownBy(() -> sessionAuthService.requireSelfOrTeacher(header, UUID.randomUUID()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("your own records");
    }

    @Test
    void requireSelfOrTeacherAllowsATeacherToAccessAnyStudentsRecords() {
        String header = bearerFor(SessionAuthService.ROLE_TEACHER);

        sessionAuthService.requireSelfOrTeacher(header, UUID.randomUUID());
        // No exception thrown = success.
    }

    @Test
    void requireStudentSelfAllowsOnlyTheMatchingStudent() {
        AuthResponse response = sessionAuthService.issueToken(SessionAuthService.ROLE_STUDENT, UUID.randomUUID(),
                "Test Student", "student-self@example.com", "APPROVED");
        String header = "Bearer " + response.token();

        assertThat(sessionAuthService.requireStudentSelf(header, response.id())).isEqualTo(response.id());
        assertThatThrownBy(() -> sessionAuthService.requireStudentSelf(header, UUID.randomUUID()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("your own student portal");
    }

    @Test
    void requireStudentSelfRejectsStaffSoTeacherScopingCannotBeBypassed() {
        String teacherHeader = bearerFor(SessionAuthService.ROLE_TEACHER);
        String adminHeader = bearerFor(SessionAuthService.ROLE_ADMIN);

        assertThatThrownBy(() -> sessionAuthService.requireStudentSelf(teacherHeader, UUID.randomUUID()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("your own student portal");
        assertThatThrownBy(() -> sessionAuthService.requireStudentSelf(adminHeader, UUID.randomUUID()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("your own student portal");
    }

    @Test
    void revokeSessionsForImmediatelyInvalidatesTheGateMethodsToo() {
        AuthResponse response = sessionAuthService.issueToken(SessionAuthService.ROLE_TEACHER, UUID.randomUUID(),
                "Test Teacher", "teacher@example.com", "APPROVED");
        String header = "Bearer " + response.token();
        assertThat(sessionAuthService.requireTeacher(header)).isEqualTo(response.id());

        sessionAuthService.revokeSessionsFor(response.id());

        assertThatThrownBy(() -> sessionAuthService.requireTeacher(header))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void logoutInvalidatesJustThatOneToken() {
        AuthResponse response = sessionAuthService.issueToken(SessionAuthService.ROLE_TEACHER, UUID.randomUUID(),
                "Test Teacher", "teacher2@example.com", "APPROVED");
        String header = "Bearer " + response.token();

        sessionAuthService.logout(response.token());

        assertThatThrownBy(() -> sessionAuthService.requireTeacher(header))
                .isInstanceOf(ResponseStatusException.class);
    }
}
