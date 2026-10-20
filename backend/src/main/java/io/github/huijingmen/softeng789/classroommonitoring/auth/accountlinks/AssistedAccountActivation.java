package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import io.github.huijingmen.softeng789.classroommonitoring.config.WorkflowCapabilities;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.TeacherScopeSupport;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/** Local, administrator-mediated activation only. Never resets an existing password or approves enrolment. */
@Service
public class AssistedAccountActivation {
    private static final Logger LOG = LoggerFactory.getLogger(AssistedAccountActivation.class);
    private final WorkflowCapabilities capabilities;
    private final TeacherScopeSupport access;
    private final StudentRepository students;
    private final TeacherRepository staff;
    private final AccountLinkTargets targets;
    private final AccountLinkRepository links;
    private final AccountLinkDelivery urls;

    public enum Kind { STUDENT, STAFF }
    public record Activation(String link, Instant expiresAt) {
        @Override public String toString() { return "AssistedActivation[redacted]"; }
    }

    public AssistedAccountActivation(WorkflowCapabilities capabilities, TeacherScopeSupport access,
            StudentRepository students, TeacherRepository staff, AccountLinkTargets targets,
            AccountLinkRepository links, AccountLinkDelivery urls) {
        this.capabilities = capabilities; this.access = access; this.students = students;
        this.staff = staff; this.targets = targets; this.links = links; this.urls = urls;
    }

    @Transactional
    public Activation issue(UUID callerId, Kind kind, UUID accountId) {
        var caller = access.requireCallerForWrite(callerId);
        if (!access.isAdmin(caller) || !capabilities.assistedActivation()) {
            throw new ResponseStatusException(FORBIDDEN, "Administrator-assisted activation is unavailable.");
        }
        var targetEmail = targetEmail(kind, accountId);
        String email = targetEmail.email();
        var purpose = targetEmail.purpose();
        var target = targets.resolve(email, purpose);
        if (target == null || !accountId.equals(target.id()) || target.passwordHash() != null) throw unavailable();
        String token = AccountLinkSecrets.generate();
        var row = new AccountLink(email.trim().toLowerCase(java.util.Locale.ROOT), purpose, Instant.now());
        row.dispatch(AccountLinkSecrets.digest(token), target.id(), target.role(),
                AccountLinkSecrets.fingerprint(target.passwordHash()), Instant.now());
        links.saveAndFlush(row);
        // Audit identifiers only: a credential must never reach logs or persistence in plaintext.
        LOG.info("Administrator {} issued local activation {} for account {}", callerId, row.getId(), accountId);
        return new Activation(urls.activationUrl(token), row.getExpiresAt());
    }

    @Transactional(readOnly = true)
    public boolean eligible(UUID callerId, Kind kind, UUID accountId) {
        if (!access.isAdmin(access.requireCaller(callerId)) || !capabilities.assistedActivation()) return false;
        var value = targetEmail(kind, accountId);
        var target = targets.resolve(value.email(), value.purpose());
        return target != null && accountId.equals(target.id()) && target.passwordHash() == null;
    }

    private record TargetEmail(String email, AccountLinkPurpose purpose) {
        @Override public String toString() { return "ActivationTarget[redacted]"; }
    }

    private TargetEmail targetEmail(Kind kind, UUID accountId) {
        String email;
        AccountLinkPurpose purpose;
        if (kind == Kind.STUDENT) {
            var student = students.findById(accountId).orElseThrow(() -> unavailable());
            email = student.getUniversityEmail();
            purpose = AccountLinkPurpose.STUDENT_REGISTRATION;
        } else {
            var teacher = staff.findById(accountId).orElseThrow(() -> unavailable());
            email = teacher.getEmail();
            purpose = AccountLinkPurpose.STAFF_ACTIVATION;
        }
        return new TargetEmail(email, purpose);
    }

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(CONFLICT,
                "Activation is only available for an active account without a password. Existing passwords are not changed.");
    }
}
