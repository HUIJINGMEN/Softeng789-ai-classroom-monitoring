package io.github.huijingmen.softeng789.classroommonitoring.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiServiceAuthenticatorTest {
    @Test
    void acceptsOnlyTheConfiguredMachineKey() {
        AiServiceAuthenticator authenticator = new AiServiceAuthenticator("private-lab-key");

        assertThatCode(() -> authenticator.requireValidKey("private-lab-key")).doesNotThrowAnyException();
        assertThatThrownBy(() -> authenticator.requireValidKey("wrong"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("401 UNAUTHORIZED");
    }

    @Test
    void blankConfigurationDisablesIngestion() {
        AiServiceAuthenticator authenticator = new AiServiceAuthenticator("");

        assertThatThrownBy(() -> authenticator.requireValidKey("anything"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("503 SERVICE_UNAVAILABLE");
    }
}
