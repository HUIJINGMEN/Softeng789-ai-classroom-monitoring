package io.github.huijingmen.softeng789.classroommonitoring.auth;

import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/** Host-only cookies; production's __Host- prefix forbids a Domain attribute or a non-root path. */
@Component
public class BrowserSessionCookies {
    private final boolean secure;

    public BrowserSessionCookies(Environment environment) {
        secure = environment.acceptsProfiles(Profiles.of("production | prod"));
    }

    public boolean secure() { return secure; }
    public String sessionName() { return secure ? "__Host-classlens-session" : "classlens-session"; }
    public String csrfName() { return secure ? "__Host-classlens-csrf" : "classlens-csrf"; }

    public String read(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        String value = null;
        for (Cookie cookie : request.getCookies()) {
            if (sessionName().equals(cookie.getName())) {
                if (value != null) return null; // Ambiguous duplicate cookies fail closed.
                value = cookie.getValue();
            }
        }
        return value;
    }

    public void issue(HttpServletResponse response, String credential) {
        write(response, credential, SessionAuthService.TOKEN_TTL);
    }

    public void clear(HttpServletResponse response) {
        write(response, "", Duration.ZERO);
    }

    private void write(HttpServletResponse response, String value, Duration lifetime) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(sessionName(), value)
                .httpOnly(true).secure(secure).sameSite("Strict").path("/").maxAge(lifetime).build().toString());
    }
}
