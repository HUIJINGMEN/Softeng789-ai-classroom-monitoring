package io.github.huijingmen.softeng789.classroommonitoring.auth;

import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Cookie is the sole HTTP credential. The header adapter preserves existing domain gate APIs;
 * caller-supplied Authorization is always replaced, never used as a second authentication path. */
public class BrowserSessionFilter extends OncePerRequestFilter {
    private final SessionAuthService sessions;
    private final BrowserSessionCookies cookies;

    public BrowserSessionFilter(SessionAuthService sessions, BrowserSessionCookies cookies) {
        this.sessions = sessions;
        this.cookies = cookies;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String credential = cookies.read(request);
        var principal = sessions.resolve(credential);
        if (principal != null) {
            String path = request.getRequestURI().substring(request.getContextPath().length());
            if ("STUDENT".equals(principal.role()) && !"APPROVED".equals(principal.approvalStatus())
                    && !path.startsWith("/api/auth/") && !path.equals("/api/classes/public")
                    && !path.startsWith("/api/ai/")) {
                response.setStatus(403);
                response.setContentType("application/problem+json");
                response.getWriter().write("{\"detail\":\"Your registration needs administrator approval.\"}");
                return;
            }
            var authentication = new UsernamePasswordAuthenticationToken(principal, null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + principal.role())));
            SecurityContextHolder.getContext().setAuthentication(authentication);
            response.setHeader("X-ClassLens-Account", principal.role() + ":" + principal.id());
        }
        String internalHeader = principal == null ? null : "Bearer " + credential;
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override public String getHeader(String name) {
                return "Authorization".equalsIgnoreCase(name) ? internalHeader : super.getHeader(name);
            }
            @Override public Enumeration<String> getHeaders(String name) {
                if (!"Authorization".equalsIgnoreCase(name)) return super.getHeaders(name);
                return Collections.enumeration(internalHeader == null ? List.of() : List.of(internalHeader));
            }
        }, response);
    }
}
