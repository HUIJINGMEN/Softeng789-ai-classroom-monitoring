package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import io.github.huijingmen.softeng789.classroommonitoring.auth.BrowserSessionCookies;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.time.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api/kiosk")
public class KioskController {
    private final KioskSessionService sessions;
    private final KioskCaptureService captures;
    private final KioskDecisionService decisions;
    private final KioskReviewService reviews;
    private final SessionAuthService auth;
    private final BrowserSessionCookies cookies;
    private final CookieCsrfTokenRepository csrf;
    public KioskController(KioskSessionService sessions, KioskCaptureService captures, KioskDecisionService decisions,
            KioskReviewService reviews, SessionAuthService auth, BrowserSessionCookies cookies, CookieCsrfTokenRepository csrf) {
        this.sessions = sessions; this.captures = captures; this.decisions = decisions;
        this.reviews = reviews; this.auth = auth; this.cookies = cookies; this.csrf = csrf;
    }
    @GetMapping("/launch-options")
    public Object options(@RequestHeader(value="Authorization", required=false) String header, @RequestParam LocalDate date,
            @RequestParam(required=false) UUID campusId) { return sessions.options(auth.requireTeacher(header), date, campusId); }

    private record Launched(Map<String, Object> body, String credential, Instant expiresAt) {
        @Override public String toString() { return "[redacted kiosk credential]"; }
    }
    @PostMapping("/sessions")
    public ResponseEntity<?> launch(@RequestHeader(value="Authorization", required=false) String header, @RequestBody KioskSessionService.Launch body,
            HttpServletRequest request, HttpServletResponse response) {
        UUID staff = auth.requireTeacher(header);
        var launched = sessions.tx.execute(s -> {
            var k = sessions.launch(staff, body);
            auth.logout(cookies.read(request));
            var credential = auth.issueTokenUntil("KIOSK", k.id, k.locationLabel, null, "APPROVED", k.expiresAt);
            return new Launched(sessions.launchView(k), credential.token(), k.expiresAt);
        });
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(cookies.sessionName(), launched.credential())
                .httpOnly(true).secure(cookies.secure()).sameSite("Strict").path("/")
                .maxAge(Duration.between(KioskTime.now(), launched.expiresAt())).build().toString());
        csrf.saveToken(null, request, response);
        return ResponseEntity.status(201).body(launched.body());
    }
    @GetMapping("/sessions")
    public Object sessions(@RequestHeader(value="Authorization", required=false) String header, @RequestParam UUID sessionId) {
        return sessions.list(auth.requireTeacher(header), sessionId);
    }
    @PostMapping("/sessions/{id}/end") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void end(@RequestHeader(value="Authorization", required=false) String header, @PathVariable UUID id) { sessions.end(auth.requireTeacher(header), id); }
    @GetMapping("/attempts")
    public Object attempts(@RequestHeader(value="Authorization", required=false) String header, @RequestParam UUID sessionId,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="50") int size) {
        return reviews.attempts(auth.requireTeacher(header), sessionId, page, size);
    }
    @GetMapping("/device")
    public Object device(@RequestHeader(value="Authorization", required=false) String header) { return sessions.device(auth.requireKiosk(header)); }
    @PostMapping(value="/device/captures", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> capture(@RequestHeader(value="Authorization", required=false) String header,
            @RequestHeader("Idempotency-Key") UUID key, @RequestPart("image") MultipartFile image) throws IOException {
        UUID kiosk = auth.requireKiosk(header);
        if (image.getSize() > 2097152) throw new KioskProblem(HttpStatus.PAYLOAD_TOO_LARGE, "IMAGE_TOO_LARGE", "The image must be at most 2 MB.");
        var result = captures.capture(kiosk, key, image.getBytes());
        return ResponseEntity.status(result.replayed() ? 200 : 201).body(result.body());
    }
    public record Confirm(String candidateId) {}
    public record Cancel(String reason) {}
    @PostMapping("/device/attempts/{id}/confirm")
    public Object confirm(@RequestHeader(value="Authorization", required=false) String header, @PathVariable UUID id, @RequestBody Confirm body) {
        return decisions.confirm(auth.requireKiosk(header), id, body.candidateId());
    }
    @PostMapping("/device/attempts/{id}/cancel") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@RequestHeader(value="Authorization", required=false) String header, @PathVariable UUID id, @RequestBody Cancel body) {
        decisions.cancel(auth.requireKiosk(header), id, body.reason());
    }
}
