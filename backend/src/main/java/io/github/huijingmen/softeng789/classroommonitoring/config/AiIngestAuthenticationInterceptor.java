package io.github.huijingmen.softeng789.classroommonitoring.config;

import io.github.huijingmen.softeng789.classroommonitoring.service.AiServiceAuthenticator;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** Applies machine authentication consistently to every inbound AI-service endpoint. */
@Component
public class AiIngestAuthenticationInterceptor implements HandlerInterceptor {
    public static final String SERVICE_KEY_HEADER = "X-AI-Service-Key";

    private final AiServiceAuthenticator authenticator;

    public AiIngestAuthenticationInterceptor(AiServiceAuthenticator authenticator) {
        this.authenticator = authenticator;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler
    ) {
        authenticator.requireValidKey(request.getHeader(SERVICE_KEY_HEADER));
        return true;
    }
}
