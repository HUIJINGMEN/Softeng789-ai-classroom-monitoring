package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/** PostgreSQL timestamptz precision, so the first response and durable replay agree exactly. */
final class KioskTime {
    private KioskTime() {}
    static Instant now() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }
}
