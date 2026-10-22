package io.github.huijingmen.softeng789.classroommonitoring.vision;

import java.time.Instant;

/** Session timestamps are real instants, as in the shared timetable contract. */
final class CheckInSessionTime {
    private CheckInSessionTime() {}

    static boolean withinWindow(Instant start, Instant end, Instant now) {
        return !now.isBefore(start.minusSeconds(15 * 60)) && now.isBefore(end);
    }
}
