package io.github.huijingmen.softeng789.classroommonitoring.vision;

import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
public class RegistrationFaceController {
    private final RegistrationFaceService service;
    private final SessionAuthService auth;
    private final VisionGateway gateway;
    public RegistrationFaceController(RegistrationFaceService service, SessionAuthService auth, VisionGateway gateway) {
        this.service = service; this.auth = auth; this.gateway = gateway;
    }
    @ModelAttribute
    void noCache(jakarta.servlet.http.HttpServletResponse response) { response.setHeader("Cache-Control", "no-store"); }

    @GetMapping("/api/auth/registration-options")
    public Map<String, Object> options() {
        return Map.of("faceEnabled", gateway.enabled(), "noticeVersion", RegistrationFaceService.NOTICE);
    }
    @GetMapping("/api/admin/students/{id}/registration-face")
    public RegistrationFaceService.Review review(@PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String token) {
        auth.requireAdmin(token); return service.review(id);
    }
    @GetMapping("/api/auth/students/{id}/registration-attendance")
    public RegistrationFaceService.Summary summary(@PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String token) {
        auth.requireStudentSelf(token, id); return service.summary(id);
    }
    @PutMapping("/api/auth/students/{id}/registration-attendance/manual")
    public void manual(@PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String token) {
        auth.requireStudentSelf(token, id); service.useManual(id);
    }
}
