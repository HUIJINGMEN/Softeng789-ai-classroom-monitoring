package io.github.huijingmen.softeng789.classroommonitoring.vision;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;

/** Local pilot limit, including failures. No images or credentials are retained. */
@Component
public class CaptureCheckLimiter {
    private record Window(long started, int count) {}
    private final Map<String, Window> clients = new HashMap<>();
    private final Clock clock;
    private Window total = new Window(0, 0);
    public CaptureCheckLimiter() { this(Clock.systemUTC()); }
    CaptureCheckLimiter(Clock clock) { this.clock = clock; }

    synchronized void acquire(String address) {
        long now = clock.millis();
        clients.entrySet().removeIf(entry -> now - entry.getValue().started() >= 60_000);
        if (now - total.started() >= 60_000) total = new Window(now, 0);
        Window client = clients.getOrDefault(address, new Window(now, 0));
        if (total.count() >= 120 || client.count() >= 60 || (!clients.containsKey(address) && clients.size() >= 1024))
            throw new ResponseStatusException(TOO_MANY_REQUESTS, "Too many photo checks. Wait one minute and try again.");
        clients.put(address, new Window(client.started(), client.count() + 1));
        total = new Window(total.started(), total.count() + 1);
    }
}
