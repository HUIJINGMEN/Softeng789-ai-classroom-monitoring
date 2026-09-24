package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Safely activates the single passwordless administrator provisioned by {@code schema.sql}.
 *
 * <p>The password comes from an environment variable rather than public registration, so knowing
 * the well-known bootstrap email and staff number is not enough to claim administrator access.
 * Once a password exists this runner is deliberately a no-op and can never rotate it.</p>
 */
@Component
public class AdminBootstrapRunner implements ApplicationRunner {
    static final String ADMIN_EMAIL = "admin@auckland.ac.nz";
    static final String ADMIN_STAFF_NUMBER = "ADMIN-0001";
    private static final Logger LOGGER = LoggerFactory.getLogger(AdminBootstrapRunner.class);

    private final TeacherRepository teacherRepository;
    private final String bootstrapPassword;
    private final PasswordEncoder passwordEncoder;

    public AdminBootstrapRunner(
            TeacherRepository teacherRepository,
            @Value("${app.bootstrap.admin-password:}") String bootstrapPassword,
            PasswordEncoder passwordEncoder
    ) {
        this.teacherRepository = teacherRepository;
        this.bootstrapPassword = bootstrapPassword;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (bootstrapPassword == null || bootstrapPassword.isBlank()) {
            return;
        }
        if (bootstrapPassword.length() < 8 || bootstrapPassword.length() > 72) {
            throw new IllegalStateException("BOOTSTRAP_ADMIN_PASSWORD must contain 8 to 72 characters.");
        }

        Teacher administrator = teacherRepository.findByEmailIgnoreCase(ADMIN_EMAIL)
                .orElseThrow(() -> new IllegalStateException(
                        "The bootstrap administrator is missing. Apply database/schema.sql first."));
        if (!ADMIN_STAFF_NUMBER.equalsIgnoreCase(administrator.getStaffNumber())
                || !SessionAuthService.ROLE_ADMIN.equals(administrator.getRole())) {
            throw new IllegalStateException("The bootstrap administrator record does not match schema.sql.");
        }
        if (administrator.getPasswordHash() != null) {
            LOGGER.info("Bootstrap administrator already has a password; no change was made.");
            return;
        }

        administrator.setPasswordHash(passwordEncoder.encode(bootstrapPassword));
        teacherRepository.save(administrator);
        LOGGER.info("Bootstrap administrator activated. Remove BOOTSTRAP_ADMIN_PASSWORD from the environment.");
    }
}
