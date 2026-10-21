package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/account-activations")
public class AssistedActivationController {
    private final SessionAuthService sessions;
    private final AssistedAccountActivation activation;

    public AssistedActivationController(SessionAuthService sessions, AssistedAccountActivation activation) {
        this.sessions = sessions; this.activation = activation;
    }

    public record Request(@NotNull AssistedAccountActivation.Kind kind, @NotNull UUID accountId,
            @AssertTrue(message = "Confirm the person's identity before creating an activation link.") boolean identityConfirmed) { }

    public record Eligibility(boolean eligible) { }

    @GetMapping("/{kind}/{accountId}")
    public Eligibility eligible(@PathVariable AssistedAccountActivation.Kind kind, @PathVariable UUID accountId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return new Eligibility(activation.eligible(sessions.requireAdmin(authorization), kind, accountId));
    }

    @PostMapping
    public ResponseEntity<AssistedAccountActivation.Activation> issue(@Valid @RequestBody Request request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        UUID adminId = sessions.requireAdmin(authorization);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(activation.issue(adminId, request.kind(), request.accountId()));
    }
}
