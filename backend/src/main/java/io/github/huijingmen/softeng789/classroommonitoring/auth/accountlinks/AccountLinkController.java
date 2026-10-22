package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

import io.github.huijingmen.softeng789.classroommonitoring.auth.BrowserSessionCookies;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/account-links")
public class AccountLinkController {
    private final AccountLinkRequests requests;
    private final AccountLinkProofs proofs;
    private final AccountPasswordReset passwords;
    private final BrowserSessionCookies cookies;
    private final SessionAuthService sessions;
    private final CookieCsrfTokenRepository csrf;
    public AccountLinkController(AccountLinkRequests requests, AccountLinkProofs proofs, AccountPasswordReset passwords,
            BrowserSessionCookies cookies, SessionAuthService sessions, CookieCsrfTokenRepository csrf) {
        this.requests = requests; this.proofs = proofs; this.passwords = passwords;
        this.cookies = cookies; this.sessions = sessions; this.csrf = csrf;
    }
    public record Request(@NotBlank @Email @Size(max = 255) String email, @NotNull AccountLinkPurpose purpose) {
        @Override public String toString() { return "AccountLinkRequest[redacted]"; }
    }
    public record Proof(@NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43}") String token) {
        @Override public String toString() { return "AccountLinkProof[redacted]"; }
    }
    public record Reset(@NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43}") String token,
            @NotBlank @Size(min = 8, max = 72) String password) {
        @Override public String toString() { return "PasswordReset[redacted]"; }
    }
    public record Accepted(String message) { }

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Accepted request(@Valid @RequestBody Request request) {
        requests.request(request.email(), request.purpose());
        return new Accepted("If this address is eligible, a single-use link will arrive shortly. Check your inbox and spam folder.");
    }
    @PostMapping("/inspect")
    public AccountLinkProofs.Details inspect(@Valid @RequestBody Proof proof) { return proofs.inspect(proof.token()); }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(@Valid @RequestBody Reset reset, HttpServletRequest request, HttpServletResponse response) {
        passwords.reset(reset.token(), reset.password());
        // No automatic login after reset. This browser must explicitly sign in as well.
        sessions.logout(cookies.read(request)); cookies.clear(response); csrf.saveToken(null, request, response);
    }
}
