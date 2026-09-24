package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminBootstrapRunnerTest {
    @Mock
    private TeacherRepository teacherRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    void blankPasswordLeavesTheDatabaseUntouched() {
        new AdminBootstrapRunner(teacherRepository, " ", passwordEncoder).run(null);

        verifyNoInteractions(teacherRepository, passwordEncoder);
    }

    @Test
    void activatesOnlyTheSchemaAdministratorWhenItHasNoPassword() {
        Teacher administrator = bootstrapAdministrator();
        when(teacherRepository.findByEmailIgnoreCase(AdminBootstrapRunner.ADMIN_EMAIL))
                .thenReturn(Optional.of(administrator));
        when(passwordEncoder.encode("private-password")).thenReturn("encoded-password");

        new AdminBootstrapRunner(teacherRepository, "private-password", passwordEncoder).run(null);

        assertThat(administrator.getPasswordHash()).isEqualTo("encoded-password");
        verify(teacherRepository).save(administrator);
    }

    @Test
    void neverOverwritesAnExistingAdministratorPassword() {
        Teacher administrator = bootstrapAdministrator();
        administrator.setPasswordHash("existing-password");
        when(teacherRepository.findByEmailIgnoreCase(AdminBootstrapRunner.ADMIN_EMAIL))
                .thenReturn(Optional.of(administrator));

        new AdminBootstrapRunner(teacherRepository, "private-password", passwordEncoder).run(null);

        assertThat(administrator.getPasswordHash()).isEqualTo("existing-password");
        verify(passwordEncoder, never()).encode("private-password");
        verify(teacherRepository, never()).save(administrator);
    }

    @Test
    void rejectsAnUnsafeBootstrapPasswordBeforeReadingTheDatabase() {
        AdminBootstrapRunner runner = new AdminBootstrapRunner(teacherRepository, "short", passwordEncoder);

        assertThatThrownBy(() -> runner.run(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("8 to 72");
        verifyNoInteractions(teacherRepository, passwordEncoder);
    }

    private Teacher bootstrapAdministrator() {
        Teacher teacher = new Teacher();
        teacher.setEmail(AdminBootstrapRunner.ADMIN_EMAIL);
        teacher.setStaffNumber(AdminBootstrapRunner.ADMIN_STAFF_NUMBER);
        teacher.setName("System Administrator");
        teacher.setRole(SessionAuthService.ROLE_ADMIN);
        return teacher;
    }
}
