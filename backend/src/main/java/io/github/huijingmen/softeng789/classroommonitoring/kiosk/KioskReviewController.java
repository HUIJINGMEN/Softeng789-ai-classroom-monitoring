package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/admin/kiosk-reviews")
public class KioskReviewController {
    private final KioskReviewService reviews;
    private final SessionAuthService auth;
    public KioskReviewController(KioskReviewService reviews, SessionAuthService auth) { this.reviews = reviews; this.auth = auth; }
    @GetMapping
    public Object list(@RequestHeader(value="Authorization", required=false) String header, @RequestParam(defaultValue="OPEN") String state,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        auth.requireAdmin(header); return reviews.reviews(state, page, size);
    }
    @GetMapping("/summary")
    public Object summary(@RequestHeader(value="Authorization", required=false) String header) { auth.requireAdmin(header); return reviews.summary(); }
    @GetMapping("/{id}/evidence")
    public ResponseEntity<org.springframework.core.io.ByteArrayResource> evidence(@RequestHeader(value="Authorization", required=false) String header, @PathVariable UUID id) {
        auth.requireAdmin(header); var image = reviews.evidence(id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType()))
                .body(new org.springframework.core.io.ByteArrayResource(image.bytes()) {
                    @Override public String toString() { return "[redacted kiosk evidence]"; }
                });
    }
    @PostMapping("/{id}/resolve")
    public Object resolve(@RequestHeader(value="Authorization", required=false) String header, @PathVariable UUID id, @RequestBody KioskReviewService.Resolve body) {
        return reviews.resolve(auth.requireAdmin(header), id, body);
    }
}
