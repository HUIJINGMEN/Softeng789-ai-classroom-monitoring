package io.github.huijingmen.softeng789.classroommonitoring.vision;

import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.io.IOException;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/vision")
public class StudentCheckInController {
    private final StudentCheckInService service;
    private final SessionAuthService auth;
    public StudentCheckInController(StudentCheckInService service, SessionAuthService auth) {
        this.service = service; this.auth = auth;
    }
    @ModelAttribute void noCache(jakarta.servlet.http.HttpServletResponse response) { response.setHeader("Cache-Control", "no-store"); }

    @GetMapping("/students/{studentId}/check-ins")
    public StudentCheckInService.Workspace workspace(@PathVariable UUID studentId,
            @RequestHeader(value = "Authorization", required = false) String token) {
        auth.requireStudentSelf(token, studentId); return service.workspace(studentId);
    }
    @PostMapping(path = "/students/{studentId}/sessions/{sessionId}/check-ins", consumes = "multipart/form-data")
    public StudentCheckInService.RequestView submit(@PathVariable UUID studentId, @PathVariable UUID sessionId,
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestHeader("Idempotency-Key") UUID key, @RequestParam boolean captureConsentConfirmed,
            @RequestPart MultipartFile image) throws IOException {
        auth.requireStudentSelf(token, studentId);
        return service.submit(studentId, sessionId, key, image.getBytes(), captureConsentConfirmed);
    }
    @GetMapping("/sessions/{sessionId}/check-ins")
    public List<StudentCheckInService.RequestView> queue(@PathVariable UUID sessionId,
            @RequestHeader(value = "Authorization", required = false) String token) {
        return service.queue(auth.requireTeacher(token), sessionId);
    }
    @PostMapping("/check-ins/{id}/decision")
    public StudentCheckInService.RequestView decide(@PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody StudentCheckInService.Decision decision) {
        return service.decide(auth.requireTeacher(token), id, decision);
    }
}
