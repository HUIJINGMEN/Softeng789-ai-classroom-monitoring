package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.http.HttpStatus.*;

class TeacherScopeSupportTest {
    private final TeacherRepository teachers = mock(TeacherRepository.class);
    private final TeacherScopeSupport access = new TeacherScopeSupport(teachers);
    private final UUID callerId = UUID.randomUUID();

    @ParameterizedTest
    @ValueSource(strings = {"TEACHER", "ADMIN"})
    void deactivatedStaffCannotPassSharedAuthorization(String role) {
        var caller = new Teacher(); caller.setRole(role); caller.setStatus("DEACTIVATED");
        when(teachers.findById(callerId)).thenReturn(Optional.of(caller));
        assertThatThrownBy(() -> access.requireCaller(callerId))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(FORBIDDEN));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"DEACTIVATED", "UNKNOWN"})
    void ordinaryAndWriteAuthorizationBothFailClosedForNonActiveStatus(String status) {
        var caller = new Teacher(); caller.setStatus(status);
        when(teachers.findById(callerId)).thenReturn(Optional.of(caller));
        when(teachers.findForAuthorization(callerId)).thenReturn(Optional.of(caller));
        assertThatThrownBy(() -> access.requireCaller(callerId))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(FORBIDDEN));
        assertThatThrownBy(() -> access.requireCallerForWrite(callerId))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(FORBIDDEN));
    }

    @Test void activeStaffAndMissingAccountKeepTheirExistingSemantics() {
        var caller = new Teacher(); caller.setStatus("ACTIVE");
        when(teachers.findById(callerId)).thenReturn(Optional.of(caller), Optional.empty());
        when(teachers.findForAuthorization(callerId)).thenReturn(Optional.of(caller), Optional.empty());
        assertThat(access.requireCaller(callerId)).isSameAs(caller);
        assertThat(access.requireCallerForWrite(callerId)).isSameAs(caller);
        assertThatThrownBy(() -> access.requireCaller(callerId))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(NOT_FOUND));
        assertThatThrownBy(() -> access.requireCallerForWrite(callerId))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(NOT_FOUND));
    }
}
