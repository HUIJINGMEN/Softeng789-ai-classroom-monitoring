package io.github.huijingmen.softeng789.classroommonitoring.auth;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:browser-session-http;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
        "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop",
        "ai.service.ingest-key=local-http-test-key"
})
@ActiveProfiles("postgres")
@AutoConfigureMockMvc
class BrowserSessionHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SessionAuthService sessions;
    @Autowired LoginSessionRepository stored;
    @Autowired TeacherRepository teachers;
    @Autowired StudentRepository students;
    @Autowired PasswordEncoder passwords;
    Teacher admin;

    @BeforeEach void setup() {
        stored.deleteAll();
        String unique = UUID.randomUUID().toString();
        admin = new Teacher(); admin.setStaffNumber(unique); admin.setEmail(unique + "@staff.test");
        admin.setName("Browser Admin"); admin.setRole("ADMIN"); admin.setPasswordHash(passwords.encode("test-password"));
        admin = teachers.saveAndFlush(admin);
    }

    private Cookie cookie(MvcResult result, String name) {
        String header = result.getResponse().getHeaders("Set-Cookie").stream()
                .filter(value -> value.startsWith(name + "=")).findFirst().orElseThrow();
        return new Cookie(name, header.substring(name.length() + 1, header.indexOf(';')));
    }

    private record Proof(Cookie cookie, String token) { }

    private Proof proof() throws Exception {
        var result = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        return new Proof(cookie(result, "classlens-csrf"), json.readTree(result.getResponse().getContentAsString()).get("token").asText());
    }

    private MvcResult login() throws Exception {
        var proof = proof();
        return mvc.perform(post("/api/auth/login").cookie(proof.cookie()).header("X-CSRF-TOKEN", proof.token())
                .contentType("application/json").content(json.writeValueAsString(
                        new io.github.huijingmen.softeng789.classroommonitoring.dto.LoginRequest(admin.getEmail(), "test-password"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").doesNotExist()).andReturn();
    }

    @Test void loginUsesHttpOnlyCookieAndDigestOnlyStorageAndBearerHttpIsRetired() throws Exception {
        var result = login();
        Cookie credential = cookie(result, "classlens-session");
        assertThat(result.getResponse().getHeaders("Set-Cookie")).anySatisfy(header ->
                assertThat(header).contains("classlens-session=", "HttpOnly", "SameSite=Strict", "Path=/"));
        assertThat(credential.getValue()).hasSize(43);
        assertThat(stored.findAll()).singleElement().satisfies(row -> {
            assertThat(row.getCredentialDigest()).hasSize(64).isNotEqualTo(credential.getValue());
            assertThat(row.getAccountId()).isEqualTo(admin.getId());
        });
        mvc.perform(get("/api/auth/me").cookie(credential)).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(admin.getId().toString())).andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + credential.getValue()))
                .andExpect(status().isUnauthorized());
        // Reconstructing the store owner must not lose an otherwise valid durable session.
        assertThat(new SessionAuthService(stored, students, teachers).requireAdmin("Bearer " + credential.getValue()))
                .isEqualTo(admin.getId());
    }

    @Test void rejectedCredentialsConsumeSharedBudgetAndBlockedRetriesCannotIssueCookies() throws Exception {
        for (int i = 0; i < 5; i++) {
            var proof = proof();
            mvc.perform(post("/api/auth/login").cookie(proof.cookie()).header("X-CSRF-TOKEN", proof.token())
                    .contentType("application/json").content(json.writeValueAsString(
                            new io.github.huijingmen.softeng789.classroommonitoring.dto.LoginRequest(
                                    admin.getEmail(), "incorrect-password"))))
                    .andExpect(status().isUnauthorized())
                    .andExpect(header().doesNotExist("Set-Cookie"));
        }
        var proof = proof();
        mvc.perform(post("/api/auth/login").cookie(proof.cookie()).header("X-CSRF-TOKEN", proof.token())
                .contentType("application/json").content(json.writeValueAsString(
                        new io.github.huijingmen.softeng789.classroommonitoring.dto.LoginRequest(
                                admin.getEmail(), "test-password"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().doesNotExist("Set-Cookie"));
        assertThat(stored.count()).isZero();
    }

    @Test void unsafeRequestsNeedRealCsrfProofIncludingLoginAndLogoutAndLogoutRevokesOnServer() throws Exception {
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        assertThat(stored.count()).isZero();
        Cookie credential = cookie(login(), "classlens-session");
        mvc.perform(post("/api/auth/logout").cookie(credential)).andExpect(status().isForbidden());
        var proof = proof();
        mvc.perform(post("/api/auth/logout").cookie(credential, proof.cookie()).header("X-CSRF-TOKEN", "forged"))
                .andExpect(status().isForbidden());
        assertThat(stored.count()).isEqualTo(1);
        mvc.perform(post("/api/auth/logout").cookie(credential, proof.cookie()).header("X-CSRF-TOKEN", proof.token()))
                .andExpect(status().isNoContent());
        assertThat(stored.count()).isZero();
        mvc.perform(get("/api/auth/me").cookie(credential)).andExpect(status().isUnauthorized());
    }

    @Test void aCachedProofWithoutItsCookieIsRejectedAndReacquiringBothAllowsTheNextOperation() throws Exception {
        Cookie credential = cookie(login(), "classlens-session");
        var old = proof();
        mvc.perform(post("/api/attendance/batch").cookie(credential).header("X-CSRF-TOKEN", old.token())
                .contentType("application/json").content("{\"sessionIds\":[]}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        var refreshed = proof();
        // Empty scope is rejected by domain validation, not CSRF; no attendance is changed.
        mvc.perform(post("/api/attendance/batch").cookie(credential, refreshed.cookie())
                .header("X-CSRF-TOKEN", refreshed.token()).contentType("application/json").content("{\"sessionIds\":[]}"))
                .andExpect(status().isBadRequest());
        assertThat(stored.count()).isEqualTo(1);
    }
    @Test void loginRotatesOldSessionAndCurrentRoleStatusAndExpiryAreRechecked() throws Exception {
        Cookie first = cookie(login(), "classlens-session");
        var proof = proof();
        var rotated = mvc.perform(post("/api/auth/login").cookie(first, proof.cookie())
                .header("X-CSRF-TOKEN", proof.token()).contentType("application/json")
                .content(json.writeValueAsString(new io.github.huijingmen.softeng789.classroommonitoring.dto.LoginRequest(admin.getEmail(), "test-password"))))
                .andExpect(status().isOk()).andReturn();
        Cookie second = cookie(rotated, "classlens-session");
        assertThat(second.getValue()).isNotEqualTo(first.getValue());
        mvc.perform(get("/api/auth/me").cookie(first)).andExpect(status().isUnauthorized());
        admin.setRole("TEACHER"); admin = teachers.saveAndFlush(admin);
        mvc.perform(get("/api/admin/staff").cookie(second)).andExpect(status().isUnauthorized());
        admin.setRole("ADMIN"); admin.setStatus("DEACTIVATED"); admin = teachers.saveAndFlush(admin);
        mvc.perform(get("/api/auth/me").cookie(second)).andExpect(status().isUnauthorized());
        admin.setStatus("ACTIVE"); admin = teachers.saveAndFlush(admin);
        mvc.perform(get("/api/auth/me").cookie(second)).andExpect(status().isUnauthorized());
        stored.deleteAll();
        String dead = sessions.issueToken("ADMIN", admin.getId(), admin.getName(), admin.getEmail(), "APPROVED").token();
        assertThat(sessions.resolve(dead)).isNotNull();
        var row = stored.findAll().getFirst();
        stored.saveAndFlush(new LoginSession(row.getCredentialDigest(), admin.getId(), "ADMIN", Instant.EPOCH, Instant.EPOCH.plusSeconds(1)));
        assertThat(sessions.resolve(dead)).isNull();
    }

    @Test void pendingStudentsCanCheckApprovalButNotReadPortalDataAndMachineExceptionsStillRequireKey() throws Exception {
        String unique = UUID.randomUUID().toString();
        Student student = new Student(); student.setStudentNumber(unique); student.setUniversityEmail(unique + "@student.test");
        student.setFirstName("Pending"); student.setLastName("Student"); student.setCourse("Test"); student.setSeat("A1");
        student.setProgramme("Test"); student.setApprovalStatus("PENDING"); student = students.saveAndFlush(student);
        String credential = sessions.issueToken("STUDENT", student.getId(), "Pending Student", student.getUniversityEmail(), "PENDING").token();
        mvc.perform(get("/api/auth/me").cookie(new Cookie("classlens-session", credential))).andExpect(status().isOk())
                .andExpect(jsonPath("$.approvalStatus").value("PENDING"));
        mvc.perform(get("/api/students/" + student.getId() + "/payments").cookie(new Cookie("classlens-session", credential)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/classes/public")).andExpect(status().isOk());
        mvc.perform(get("/api/future-private-feature")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ai/behaviour-events").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ai/behaviour-events").header("X-AI-Service-Key", "local-http-test-key")
                .contentType("application/json").content("{}")).andExpect(status().isBadRequest());
    }

    @Test void productionCookiesAreSecureHostOnlyAndCannotBeScopedToAnotherDomain() {
        var environment = new MockEnvironment(); environment.setActiveProfiles("production");
        var cookies = new BrowserSessionCookies(environment);
        var response = new MockHttpServletResponse(); cookies.issue(response, "test-only-value");
        assertThat(response.getHeader("Set-Cookie")).contains("__Host-classlens-session=", "Secure", "HttpOnly",
                "SameSite=Strict", "Path=/").doesNotContain("Domain=");
    }
}
