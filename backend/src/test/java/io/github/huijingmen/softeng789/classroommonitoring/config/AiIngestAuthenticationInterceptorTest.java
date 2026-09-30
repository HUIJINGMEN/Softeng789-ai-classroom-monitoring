package io.github.huijingmen.softeng789.classroommonitoring.config;

import io.github.huijingmen.softeng789.classroommonitoring.service.AiServiceAuthenticator;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiIngestAuthenticationInterceptorTest {
    private final AiIngestAuthenticationInterceptor interceptor =
            new AiIngestAuthenticationInterceptor(new AiServiceAuthenticator("private-lab-key"));

    @Test
    void acceptsConfiguredServiceKey() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(AiIngestAuthenticationInterceptor.SERVICE_KEY_HEADER, "private-lab-key");

        boolean accepted = interceptor.preHandle(request, new MockHttpServletResponse(), new Object());

        assertTrue(accepted);
    }

    @Test
    void rejectsMissingServiceKey() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        assertThrows(
                ResponseStatusException.class,
                () -> interceptor.preHandle(request, new MockHttpServletResponse(), new Object())
        );
    }
}
