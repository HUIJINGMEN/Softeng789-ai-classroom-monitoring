package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountPasswordReset {
    private final AccountLinkProofs proofs;
    private final StudentRepository students;
    private final TeacherRepository staff;
    private final PasswordEncoder passwords;
    private final SessionAuthService sessions;
    public AccountPasswordReset(AccountLinkProofs proofs, StudentRepository students, TeacherRepository staff,
            PasswordEncoder passwords, SessionAuthService sessions) {
        this.proofs = proofs; this.students = students; this.staff = staff; this.passwords = passwords; this.sessions = sessions;
    }

    @Transactional
    public void reset(String token, String password) {
        AccountPasswordPolicy.require(password);
        var proof = proofs.consumePasswordReset(token);
        String hash = passwords.encode(password);
        if ("STUDENT".equals(proof.getAccountRole())) {
            students.findById(proof.getAccountId()).orElseThrow().setPasswordHash(hash);
        } else {
            staff.findById(proof.getAccountId()).orElseThrow().setPasswordHash(hash);
        }
        // Same commit as the password and single-use proof; every device must sign in again.
        sessions.revokeSessionsFor(proof.getAccountId());
    }
}
