package io.github.huijingmen.softeng789.classroommonitoring.auth;

import jakarta.servlet.http.Cookie;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

/** Domain HTTP tests use real session cookies. CSRF protocol failures have separate end-to-end tests. */
public final class BrowserTestSession {
    private BrowserTestSession() { }

    public static RequestPostProcessor browserSession(String internalCredential) {
        String credential = internalCredential.startsWith("Bearer ") ? internalCredential.substring(7) : internalCredential;
        return request -> {
            request.setCookies(new Cookie("classlens-session", credential));
            return csrf().asHeader().postProcessRequest(request);
        };
    }
}
