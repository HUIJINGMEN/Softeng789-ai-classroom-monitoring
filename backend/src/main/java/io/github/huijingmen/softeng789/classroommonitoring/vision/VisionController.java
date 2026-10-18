package io.github.huijingmen.softeng789.classroommonitoring.vision;

import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.StaffAccessService;
import java.io.IOException;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

@RestController
@RequestMapping("/api/vision")
public class VisionController {
    @ModelAttribute
    void noCache(jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
    }
    private final VisionService service;
    private final SessionAuthService auth;
    private final StaffAccessService access;
    private final VisionGateway gateway;
    public VisionController(VisionService service, SessionAuthService auth, StaffAccessService access, VisionGateway gateway) {
        this.service = service; this.auth = auth; this.access = access; this.gateway = gateway;
    }
    @GetMapping("/status")
    public Map<String, Boolean> status(@RequestHeader(value = "Authorization", required = false) String token) {
        auth.requireTeacher(token); return Map.of("enabled", gateway.enabled());
    }
    @GetMapping("/students/{id}")
    public VisionService.Profile profile(@PathVariable UUID id, @RequestHeader(value = "Authorization", required = false) String token) {
        auth.requireSelfOrTeacher(token, id).ifPresent(teacher -> access.requireStudentAccess(teacher, id));
        return service.profile(id);
    }
    @PutMapping("/students/{id}/consent")
    public VisionService.Profile consent(@PathVariable UUID id, @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody VisionService.Consent request) {
        auth.requireStudentSelf(token, id); return service.consent(id, request);
    }
    @PostMapping(path = "/students/{id}/enrollment", consumes = "multipart/form-data")
    public VisionService.Profile enroll(@PathVariable UUID id, @RequestHeader(value = "Authorization", required = false) String token,
            @RequestParam boolean teacherConfirmed, @RequestPart List<MultipartFile> images) throws IOException {
        UUID teacher = auth.requireTeacher(token); access.requireStudentAccess(teacher, id);
        if (images.size() != 7) throw new ResponseStatusException(BAD_REQUEST, "Seven captures are required.");
        List<byte[]> content = new ArrayList<>(); for (MultipartFile image : images) content.add(image.getBytes());
        return service.enroll(teacher, id, teacherConfirmed, content);
    }
    @GetMapping("/sessions/{id}/roster")
    public List<Map<String, Object>> roster(@PathVariable UUID id, @RequestHeader(value = "Authorization", required = false) String token) {
        return service.roster(auth.requireTeacher(token), id);
    }
    @PostMapping(path = "/sessions/{id}/photos", consumes = "multipart/form-data")
    public VisionService.ReviewResult recognize(@PathVariable UUID id, @RequestHeader(value = "Authorization", required = false) String token,
            @RequestHeader("Idempotency-Key") UUID key, @RequestParam boolean captureConsentConfirmed,
            @RequestPart MultipartFile image) throws IOException {
        UUID teacher = auth.requireTeacher(token); access.requireSessionAccess(teacher, id);
        return service.recognize(teacher, id, key, image.getBytes(), captureConsentConfirmed);
    }
    @GetMapping("/reviews/{id}")
    public VisionService.ReviewResult review(@PathVariable UUID id, @RequestHeader(value = "Authorization", required = false) String token) {
        return service.getReview(auth.requireTeacher(token), id);
    }
    @PostMapping("/reviews/{id}/confirm")
    public VisionService.ReviewResult confirm(@PathVariable UUID id, @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody VisionService.ReviewRequest request) {
        return service.review(auth.requireTeacher(token), id, request);
    }
}
