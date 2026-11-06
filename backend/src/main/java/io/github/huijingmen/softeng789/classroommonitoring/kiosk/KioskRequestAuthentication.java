package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService.Principal;

/**
 * A single synchronous HTTP dispatch may resolve its cookie in several domain gates.
 * Cache only that dispatch's successful kiosk identity, keyed by credential digest.
 * The outer filter always removes it; mutations still recheck live domain eligibility.
 */
public final class KioskRequestAuthentication {
    private KioskRequestAuthentication() {}
    private static final ThreadLocal<Entry> CURRENT = new ThreadLocal<>();
    private static final class Entry {
        String digest;
        Principal principal;
    }
    static void begin() { CURRENT.set(new Entry()); }
    static void end() { CURRENT.remove(); }
    public static Principal get(String digest) {
        var entry = CURRENT.get();
        return entry != null && digest.equals(entry.digest) ? entry.principal : null;
    }
    public static void remember(String digest, Principal principal) {
        var entry = CURRENT.get();
        if (entry != null) { entry.digest = digest; entry.principal = principal; }
    }
    public static void invalidate() {
        var entry = CURRENT.get();
        if (entry != null) { entry.digest = null; entry.principal = null; }
    }
}
