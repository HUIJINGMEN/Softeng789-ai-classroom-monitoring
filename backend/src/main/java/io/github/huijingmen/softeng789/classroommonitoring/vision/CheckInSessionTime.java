package io.github.huijingmen.softeng789.classroommonitoring.vision;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** Adapter for the existing timetable's Auckland wall-clock values encoded with a Z suffix.
 * Only scheduled times use this convention; request/attendance/audit timestamps are real instants.
 */
final class CheckInSessionTime {
    static final ZoneId ZONE = ZoneId.of("Pacific/Auckland");
    private CheckInSessionTime() {}

    static Instant actual(Instant stored) {
        return LocalDateTime.ofInstant(stored, ZoneOffset.UTC).atZone(ZONE).toInstant();
    }

    static Instant stored(Instant actual) {
        return LocalDateTime.ofInstant(actual, ZONE).toInstant(ZoneOffset.UTC);
    }

    static boolean withinWindow(Instant storedStart, Instant storedEnd, Instant now) {
        return !now.isBefore(actual(storedStart).minusSeconds(15 * 60)) && now.isBefore(actual(storedEnd));
    }
}
