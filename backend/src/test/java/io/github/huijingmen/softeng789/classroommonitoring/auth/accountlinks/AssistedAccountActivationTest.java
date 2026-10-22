package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import io.github.huijingmen.softeng789.classroommonitoring.config.WorkflowCapabilities;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.TeacherScopeSupport;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AssistedAccountActivationTest {
    private final TeacherScopeSupport access = mock(TeacherScopeSupport.class);
    private final StudentRepository students = mock(StudentRepository.class);
    private final TeacherRepository staff = mock(TeacherRepository.class);
    private final AccountLinkTargets targets = mock(AccountLinkTargets.class);
    private final AccountLinkRepository links = mock(AccountLinkRepository.class);
    private final AccountLinkDelivery urls = mock(AccountLinkDelivery.class);
    private final UUID adminId = UUID.randomUUID();
    private final UUID targetId = UUID.randomUUID();
    private final Teacher admin = new Teacher();

    private AssistedAccountActivation service(String profile) {
        var environment = new MockEnvironment(); environment.setActiveProfiles(profile);
        when(access.requireCallerForWrite(adminId)).thenReturn(admin);
        when(access.isAdmin(admin)).thenReturn(true);
        return new AssistedAccountActivation(new WorkflowCapabilities(environment, new DisabledAccountLinkMailGateway()),
                access, students, staff, targets, links, urls);
    }

    @Test void disabledAccountMailDoesNotBlockAdministratorMediatedLocalActivation() {
        var service = service("postgres");
        var invited = new Teacher(); invited.setEmail("invited@example.test");
        when(staff.findById(targetId)).thenReturn(Optional.of(invited));
        when(targets.resolve(invited.getEmail(), AccountLinkPurpose.STAFF_ACTIVATION))
                .thenReturn(new AccountLinkTargets.Target(targetId, "TEACHER", null));
        when(urls.activationUrl(anyString())).thenAnswer(call -> "http://localhost:5173/#account-link=" + call.getArgument(0));
        var activation = service.issue(adminId, AssistedAccountActivation.Kind.STAFF, targetId);
        assertThat(activation.link()).startsWith("http://localhost:5173/#account-link=");
        var saved = org.mockito.ArgumentCaptor.forClass(AccountLink.class);
        verify(links).saveAndFlush(saved.capture());
        String token = activation.link().substring(activation.link().indexOf('=') + 1);
        assertThat(saved.getValue().getCredentialDigest()).isEqualTo(AccountLinkSecrets.digest(token));
        assertThat(saved.getValue().getAccountId()).isEqualTo(targetId);
    }

    @Test void productionAndAliasDenyIssuanceEvenForAnAdministrator() {
        for (String profile : new String[]{"production", "prod"}) {
            var service = service(profile);
            assertThatThrownBy(() -> service.issue(adminId, AssistedAccountActivation.Kind.STAFF, targetId))
                    .isInstanceOfSatisfying(ResponseStatusException.class, failure -> assertThat(failure.getStatusCode().value()).isEqualTo(403));
        }
        verifyNoInteractions(students, staff, targets, links, urls);
    }

    @Test void deactivatedAdministratorCannotIssueCredentials() {
        var service = service("postgres");
        when(access.requireCallerForWrite(adminId)).thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN));
        assertThatThrownBy(() -> service.issue(adminId, AssistedAccountActivation.Kind.STAFF, targetId))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(students, staff, targets, links, urls);
    }

    @Test void ineligibleOrReboundTargetCannotReceiveAProof() {
        var service = service("postgres");
        var invited = new Teacher(); invited.setEmail("invited@example.test");
        when(staff.findById(targetId)).thenReturn(Optional.of(invited));
        for (var value : new AccountLinkTargets.Target[]{null,
                new AccountLinkTargets.Target(UUID.randomUUID(), "TEACHER", null),
                new AccountLinkTargets.Target(targetId, "TEACHER", "existing-password")}) {
            when(targets.resolve(invited.getEmail(), AccountLinkPurpose.STAFF_ACTIVATION)).thenReturn(value);
            assertThatThrownBy(() -> service.issue(adminId, AssistedAccountActivation.Kind.STAFF, targetId))
                    .isInstanceOf(ResponseStatusException.class);
        }
        verifyNoInteractions(links, urls);
    }
}
