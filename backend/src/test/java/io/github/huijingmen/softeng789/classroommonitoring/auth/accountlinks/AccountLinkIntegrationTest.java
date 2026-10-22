package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import io.github.huijingmen.softeng789.classroommonitoring.dto.LoginRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RegisterTeacherRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.AuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.auth.LoginSessionRepository;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:account-links;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
        "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop", "debug=false"
})
@ActiveProfiles("postgres")
@AutoConfigureMockMvc
@Import(AccountLinkTestInbox.class)
class AccountLinkIntegrationTest {
    @Autowired AccountLinkRequests requests;
    @Autowired AccountLinkWorker worker;
    @Autowired AccountLinkTestInbox.Inbox inbox;
    @Autowired AccountLinkProofs proofs;
    @Autowired AccountPasswordReset resets;
    @Autowired AccountLinkRepository links;
    @Autowired TeacherRepository staff;
    @Autowired PasswordEncoder passwords;
    @Autowired SessionAuthService sessions;
    @Autowired LoginSessionRepository sessionRows;
    @Autowired AuthService auth;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired AssistedAccountActivation assisted;
    @Autowired io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository students;

    @BeforeEach void cleanQueue() { links.deleteAll(); inbox.fail(false); }

    private Teacher account(String role, boolean password) {
        String unique = UUID.randomUUID().toString();
        var t = new Teacher(); t.setEmail(unique + "@accounts.test"); t.setStaffNumber(unique);
        t.setName("Invited staff"); t.setRole(role);
        if (password) t.setPasswordHash(passwords.encode("old-password"));
        return staff.saveAndFlush(t);
    }

    private String issue(String email, AccountLinkPurpose purpose) {
        requests.request(email, purpose); worker.deliverNext(); return inbox.take(email);
    }

    @Test void localAssistanceActivatesStaffWithSingleUseBoundProofAndNeverEmails() {
        var admin = account("ADMIN", true);
        var teacher = account("TEACHER", false);
        var result = assisted.issue(admin.getId(), AssistedAccountActivation.Kind.STAFF, teacher.getId());
        String token = result.link().substring(result.link().indexOf("#account-link=") + "#account-link=".length());
        assertThat(result.toString()).doesNotContain(token, teacher.getEmail());
        assertThat(result.expiresAt()).isAfter(Instant.now()).isBefore(Instant.now().plusSeconds(1801));
        assertThat(links.findAll()).singleElement().satisfies(row -> {
            assertThat(row.getState()).isEqualTo("DISPATCHED");
            assertThat(row.getCredentialDigest()).hasSize(64).isNotEqualTo(token);
        });
        assertThatThrownBy(() -> inbox.take(teacher.getEmail())).isInstanceOf(IllegalStateException.class);
        assertThat(proofs.inspect(token).purpose()).isEqualTo(AccountLinkPurpose.STAFF_ACTIVATION);
        var activated = auth.registerTeacher(new RegisterTeacherRequest(teacher.getStaffNumber(), teacher.getEmail(),
                "Invited staff", "new-password", token));
        assertThat(activated.role()).isEqualTo("TEACHER");
        assertThatThrownBy(() -> proofs.inspect(token)).isInstanceOf(ResponseStatusException.class);
    }

    @Test void localAssistanceCannotResetAnExistingPasswordOrBeUsedByTeachers() {
        var admin = account("ADMIN", true);
        var teacher = account("TEACHER", true);
        var invited = account("TEACHER", false);
        assertThatThrownBy(() -> assisted.issue(admin.getId(), AssistedAccountActivation.Kind.STAFF, teacher.getId()))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> assisted.issue(teacher.getId(), AssistedAccountActivation.Kind.STAFF, invited.getId()))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(links.count()).isZero();
        assertThat(passwords.matches("old-password", staff.findById(teacher.getId()).orElseThrow().getPasswordHash())).isTrue();
    }

    @Test void preProvisionedStudentProofPreservesApprovalAndCannotBeSwappedAcrossAccounts() {
        var admin = account("ADMIN", true);
        var student = new io.github.huijingmen.softeng789.classroommonitoring.entity.Student();
        student.setStudentNumber(UUID.randomUUID().toString());
        student.setUniversityEmail(UUID.randomUUID() + "@student.test");
        student.setFirstName("Precreated"); student.setLastName("Student"); student.setCourse("TEST");
        student.setSeat("Unassigned"); student.setProgramme(""); student.setApprovalStatus("PENDING");
        student = students.saveAndFlush(student);
        var result = assisted.issue(admin.getId(), AssistedAccountActivation.Kind.STUDENT, student.getId());
        String token = result.link().substring(result.link().indexOf("#account-link=") + "#account-link=".length());
        assertThat(proofs.inspect(token).role()).isEqualTo("STUDENT");
        assertThat(students.findById(student.getId()).orElseThrow().getApprovalStatus()).isEqualTo("PENDING");
        assertThat(students.findById(student.getId()).orElseThrow().getPasswordHash()).isNull();
        final var existing = student;
        assertThatThrownBy(() -> proofs.checkRegistration(token, AccountLinkPurpose.STUDENT_REGISTRATION,
                existing.getUniversityEmail(), UUID.randomUUID(), "STUDENT")).isInstanceOf(ResponseStatusException.class);
        var template = new TransactionTemplate(transactions);
        template.executeWithoutResult(status -> proofs.consumeRegistration(token, AccountLinkPurpose.STUDENT_REGISTRATION,
                existing.getUniversityEmail(), existing.getId(), "STUDENT"));
        assertThatThrownBy(() -> proofs.inspect(token)).isInstanceOf(ResponseStatusException.class);
    }

    @Test void assistedActivationHttpRequiresAdminSessionCsrfAndIdentityConfirmation() throws Exception {
        var admin = account("ADMIN", true); var teacher = account("TEACHER", true); var invited = account("TEACHER", false);
        String adminToken = sessions.issueToken("ADMIN", admin.getId(), admin.getName(), admin.getEmail(), "APPROVED").token();
        String teacherToken = sessions.issueToken("TEACHER", teacher.getId(), teacher.getName(), teacher.getEmail(), "APPROVED").token();
        String body = "{\"kind\":\"STAFF\",\"accountId\":\"" + invited.getId() + "\",\"identityConfirmed\":true}";
        mvc.perform(get("/api/auth/capabilities")).andExpect(status().isOk())
                .andExpect(jsonPath("$.assistedActivation").value(true));
        mvc.perform(post("/api/admin/account-activations").with(csrf()).contentType("application/json").content(body))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/account-activations").cookie(new jakarta.servlet.http.Cookie("classlens-session", teacherToken))
                .with(csrf()).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/account-activations").cookie(new jakarta.servlet.http.Cookie("classlens-session", adminToken))
                .contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/account-activations").cookie(new jakarta.servlet.http.Cookie("classlens-session", adminToken))
                .with(csrf()).contentType("application/json").content(body.replace("true", "false")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/account-activations").cookie(new jakarta.servlet.http.Cookie("classlens-session", adminToken))
                .with(csrf()).contentType("application/json").content(body)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"));
        assertThat(links.count()).isEqualTo(1);
    }

    @Test void staffActivationRequiresEmailProofAndConsumesItWithoutChangingAssignedRole() {
        var teacher = account("TEACHER", false);
        assertThatThrownBy(() -> auth.registerTeacher(new RegisterTeacherRequest(teacher.getStaffNumber(),
                teacher.getEmail(), "Teacher", "new-password"))).isInstanceOf(ResponseStatusException.class);
        assertThat(staff.findById(teacher.getId()).orElseThrow().getPasswordHash()).isNull();
        String token = issue(teacher.getEmail(), AccountLinkPurpose.STAFF_ACTIVATION);
        assertThat(links.findAll()).singleElement().satisfies(row ->
                assertThat(row.getCredentialDigest()).hasSize(64).isNotEqualTo(token));
        var registration = new RegisterTeacherRequest(teacher.getStaffNumber(), teacher.getEmail(), "Teacher", "new-password", token);
        var activated = auth.registerTeacher(registration);
        assertThat(activated.role()).isEqualTo("TEACHER");
        assertThat(activated.id()).isEqualTo(teacher.getId());
        assertThatThrownBy(() -> proofs.inspect(token)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> auth.registerTeacher(registration)).isInstanceOf(ResponseStatusException.class);
    }

    @Test void existingAdministratorMayActivateOnlyWithProofAndCannotSelectAnotherRole() {
        var admin = account("ADMIN", false);
        String token = issue(admin.getEmail(), AccountLinkPurpose.STAFF_ACTIVATION);
        var response = auth.registerTeacher(new RegisterTeacherRequest(admin.getStaffNumber(), admin.getEmail(), "Admin", "new-password", token));
        assertThat(response.role()).isEqualTo("ADMIN");
        assertThat(staff.findById(admin.getId()).orElseThrow().getStaffNumber()).isEqualTo(admin.getStaffNumber());
    }

    @Test void registrationProofCannotBeSwappedAcrossEmailAccountOrPurpose() {
        var first = account("TEACHER", false); var second = account("TEACHER", false);
        String token = issue(first.getEmail(), AccountLinkPurpose.STAFF_ACTIVATION);
        assertThatThrownBy(() -> auth.registerTeacher(new RegisterTeacherRequest(second.getStaffNumber(), second.getEmail(),
                "Wrong account", "new-password", token))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> resets.reset(token, "new-password")).isInstanceOf(ResponseStatusException.class);
        assertThat(proofs.inspect(token).email()).isEqualTo(first.getEmail());
    }

    @Test void passwordResetRevokesAllSessionsAndOtherOutstandingLinksAndDoesNotAutoLogin() throws Exception {
        var admin = account("ADMIN", true);
        String first = sessions.issueToken("ADMIN", admin.getId(), admin.getName(), admin.getEmail(), "APPROVED").token();
        String second = sessions.issueToken("ADMIN", admin.getId(), admin.getName(), admin.getEmail(), "APPROVED").token();
        String token = issue(admin.getEmail(), AccountLinkPurpose.PASSWORD_RESET);
        String sibling = issue(admin.getEmail(), AccountLinkPurpose.PASSWORD_RESET);
        mvc.perform(post("/api/auth/account-links/reset-password").with(csrf()).contentType("application/json")
                        .content("{\"token\":\"" + token + "\",\"password\":\"new-password\"}"))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(sessions.resolve(first)).isNull(); assertThat(sessions.resolve(second)).isNull();
        assertThat(sessionRows.findAll()).noneMatch(s -> s.getAccountId().equals(admin.getId()));
        assertThatThrownBy(() -> resets.reset(token, "another-password")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> resets.reset(sibling, "another-password")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> auth.login(new LoginRequest(admin.getEmail(), "old-password"))).isInstanceOf(ResponseStatusException.class);
        assertThat(auth.login(new LoginRequest(admin.getEmail(), "new-password")).id()).isEqualTo(admin.getId());
    }

    @Test void currentStatusRoleEmailAndPasswordInvalidateEarlierLinks() {
        for (String change : new String[]{"status", "role", "email", "password"}) {
            var account = account("TEACHER", true);
            String token = issue(account.getEmail(), AccountLinkPurpose.PASSWORD_RESET);
            switch (change) {
                case "status" -> account.setStatus("DEACTIVATED");
                case "role" -> account.setRole("ADMIN");
                case "email" -> account.setEmail(UUID.randomUUID() + "@changed.test");
                case "password" -> account.setPasswordHash(passwords.encode("changed-password"));
                default -> throw new IllegalStateException();
            }
            staff.saveAndFlush(account);
            assertThatThrownBy(() -> resets.reset(token, "new-password")).isInstanceOf(ResponseStatusException.class);
        }
    }

    @Test void exactExpiryAndInvalidTokensAreRejectedWithoutConsumingValidProof() {
        var teacher = account("TEACHER", true);
        String token = issue(teacher.getEmail(), AccountLinkPurpose.PASSWORD_RESET);
        assertThatThrownBy(() -> proofs.inspect("not-a-token")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> proofs.inspect("z".repeat(43))).isInstanceOf(ResponseStatusException.class);
        assertThat(proofs.inspect(token).email()).isEqualTo(teacher.getEmail());
        jdbc.update("update account_links set expires_at = ?", java.sql.Timestamp.from(Instant.now()));
        assertThatThrownBy(() -> resets.reset(token, "new-password")).isInstanceOf(ResponseStatusException.class);
        worker.cleanup(); assertThat(links.count()).isZero();
    }

    @Test void proofConsumptionRollsBackTogetherWithFailedRegistration() {
        String email = UUID.randomUUID() + "@student.test";
        String token = issue(email, AccountLinkPurpose.STUDENT_REGISTRATION);
        assertThatThrownBy(() -> new TransactionTemplate(transactions).execute(status -> {
            proofs.consumeRegistration(token, AccountLinkPurpose.STUDENT_REGISTRATION, email, null, "STUDENT");
            throw new IllegalStateException("later persistence failed");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(proofs.inspect(token).email()).isEqualTo(email);
    }

    @Test void requestResponsesAreGenericAsynchronousAndRateLimitedWithoutBlockingNormalLogin() throws Exception {
        var account = account("TEACHER", true);
        String body = "{\"email\":\"" + account.getEmail() + "\",\"purpose\":\"PASSWORD_RESET\"}";
        var known = mvc.perform(post("/api/auth/account-links").with(csrf()).contentType("application/json").content(body))
                .andExpect(status().isAccepted()).andExpect(jsonPath("$.token").doesNotExist()).andReturn();
        var unknown = mvc.perform(post("/api/auth/account-links").with(csrf()).contentType("application/json")
                        .content(body.replace(account.getEmail(), UUID.randomUUID() + "@unknown.test")))
                .andExpect(status().isAccepted()).andReturn();
        assertThat(known.getResponse().getContentAsString()).isEqualTo(unknown.getResponse().getContentAsString());
        assertThat(links.findAll()).allMatch(row -> row.getCredentialDigest() == null);
        requests.request(account.getEmail(), AccountLinkPurpose.PASSWORD_RESET);
        requests.request(account.getEmail(), AccountLinkPurpose.PASSWORD_RESET);
        mvc.perform(post("/api/auth/account-links").with(csrf()).contentType("application/json").content(body))
                .andExpect(status().isTooManyRequests());
        assertThat(auth.login(new LoginRequest(account.getEmail(), "old-password")).id()).isEqualTo(account.getId());
        mvc.perform(post("/api/auth/account-links").contentType("application/json").content(body)).andExpect(status().isForbidden());
    }

    @Test void uncertainDeliveryIsNotReplayedAndDiagnosticsNeverContainSecrets() {
        var account = account("ADMIN", true);
        requests.request(account.getEmail(), AccountLinkPurpose.PASSWORD_RESET);
        inbox.fail(true); worker.deliverNext(); inbox.fail(false); worker.deliverNext();
        assertThatThrownBy(() -> inbox.take(account.getEmail())).isInstanceOf(IllegalStateException.class);
        assertThat(links.findAll()).singleElement().satisfies(row -> assertThat(row.getState()).isEqualTo("DISPATCHED"));
        assertThat(new AccountLinkController.Reset("secret", "password").toString()).doesNotContain("secret", "password");
        assertThat(new AccountLinkDelivery.Mail("private", AccountLinkPurpose.PASSWORD_RESET, "secret").toString()).doesNotContain("private", "secret");
    }

    @Test void concurrentRedemptionHasExactlyOneWinner() throws Exception {
        var account = account("TEACHER", true);
        String token = issue(account.getEmail(), AccountLinkPurpose.PASSWORD_RESET);
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Boolean> redeem = () -> {
                assertThat(gate.await(5, TimeUnit.SECONDS)).isTrue();
                try { resets.reset(token, "new-password"); return true; }
                catch (ResponseStatusException used) { return false; }
            };
            var first = executor.submit(redeem); var second = executor.submit(redeem); gate.countDown();
            assertThat(java.util.List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
        }
    }

    @Test void passwordPolicyRejectsMultibyteTruncationAndInvalidPasswordDoesNotBurnProof() {
        var account = account("ADMIN", true);
        String token = issue(account.getEmail(), AccountLinkPurpose.PASSWORD_RESET);
        assertThatThrownBy(() -> resets.reset(token, "好".repeat(25))).isInstanceOf(ResponseStatusException.class);
        assertThat(proofs.inspect(token)).isNotNull();
        assertThatCode(() -> resets.reset(token, "好".repeat(24))).doesNotThrowAnyException();
    }
}
