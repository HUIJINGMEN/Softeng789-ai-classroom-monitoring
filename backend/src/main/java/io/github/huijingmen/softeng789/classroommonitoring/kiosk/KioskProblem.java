package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Only safe, application-owned detail text crosses the kiosk boundary. */
public final class KioskProblem extends ResponseStatusException {
    private final org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
    @Override public org.springframework.http.HttpHeaders getHeaders() { return headers; }
    public KioskProblem(HttpStatus status, String code, String detail) {
        super(status, detail);
        getBody().setProperty("code", code);
        if (status == HttpStatus.TOO_MANY_REQUESTS) getHeaders().set("Retry-After", "2");
    }
    public static KioskProblem problem(HttpStatus status, String code, String detail) {
        return new KioskProblem(status, code, detail);
    }
    public static KioskProblem blocked(String reason) {
        var error = problem(HttpStatus.CONFLICT, "SESSION_NOT_LAUNCHABLE", "This class cannot launch a kiosk now.");
        error.getBody().setProperty("reason", reason);
        return error;
    }
}
