package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Includes security, CSRF, validation and multipart failures, not only successful controller responses. */
@Component @Order(Ordered.HIGHEST_PRECEDENCE)
public class KioskHttp extends OncePerRequestFilter {
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (path.equals("/api/kiosk") || path.startsWith("/api/kiosk/")
                || path.equals("/api/admin/kiosk-reviews") || path.startsWith("/api/admin/kiosk-reviews/"))
            response.setHeader("Cache-Control", "no-store");
        chain.doFilter(request, response);
    }
}
