package io.github.huijingmen.softeng789.classroommonitoring.vision;

import io.github.huijingmen.softeng789.classroommonitoring.service.ImageUploadService;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.StaffAccessService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/** Ephemeral precheck. Final registration/enrollment never trusts a browser precheck result. */
@RestController
public class CaptureCheckController {
    private final VisionGateway gateway;
    private final VisionService vision;
    private final ImageUploadService images;
    private final CaptureCheckLimiter limiter;
    private final SessionAuthService auth;
    private final StaffAccessService access;
    public CaptureCheckController(VisionGateway gateway, VisionService vision, ImageUploadService images,
            CaptureCheckLimiter limiter, SessionAuthService auth, StaffAccessService access) {
        this.gateway = gateway; this.vision = vision; this.images = images;
        this.limiter = limiter; this.auth = auth; this.access = access;
    }
    @ModelAttribute void noCache(HttpServletResponse response) { response.setHeader("Cache-Control", "no-store"); }

    @PostMapping(path = "/api/auth/registration-capture-check", consumes = "multipart/form-data")
    public VisionGateway.CaptureCheck registration(@RequestPart MultipartFile image,
            @RequestParam boolean consentGiven, @RequestParam boolean adultConfirmed,
            @RequestParam String noticeVersion, HttpServletRequest request) {
        if (!consentGiven || !adultConfirmed || !RegistrationFaceService.NOTICE.equals(noticeVersion))
            throw new ResponseStatusException(BAD_REQUEST, "Confirm adult volunteer consent before checking photos, or choose manual attendance.");
        return check(image, request);
    }
    @PostMapping(path = "/api/vision/students/{id}/capture-check", consumes = "multipart/form-data")
    public VisionGateway.CaptureCheck supervised(@PathVariable UUID id, @RequestPart MultipartFile image,
            @RequestHeader(value = "Authorization", required = false) String token, HttpServletRequest request) {
        UUID teacher = auth.requireTeacher(token); access.requireStudentAccess(teacher, id);
        if (!vision.profile(id).consentActive()) throw new ResponseStatusException(FORBIDDEN, "Active student consent is required.");
        return check(image, request);
    }
    private VisionGateway.CaptureCheck check(MultipartFile image, HttpServletRequest request) {
        gateway.requireEnabled();
        // Do not trust caller-provided forwarding headers as a rate-limit identity.
        limiter.acquire(request.getRemoteAddr());
        if (image.isEmpty() || image.getSize() > 7L * 1024 * 1024)
            throw new ResponseStatusException(PAYLOAD_TOO_LARGE, "Use a non-empty JPEG or PNG smaller than 7 MB.");
        return VisionGateway.captureResult(vision.infer(() -> {
            byte[] jpeg = images.normaliseToJpeg(image);
            if (jpeg.length > 7 * 1024 * 1024) throw new ResponseStatusException(PAYLOAD_TOO_LARGE, "Normalized photo exceeds 7 MB.");
            return gateway.checkCapture(jpeg);
        }));
    }
}
