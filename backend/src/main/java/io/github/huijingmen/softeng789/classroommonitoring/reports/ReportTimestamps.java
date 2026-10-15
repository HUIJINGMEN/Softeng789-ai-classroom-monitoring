package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/** Keep entity metadata and database-reloaded views identical at timestamp-column precision. */
final class ReportTimestamps {
    private ReportTimestamps() { }

    static Instant now() {
        return normalize(Instant.now());
    }

    static Instant normalize(Instant value) {
        return value == null ? null : value.truncatedTo(ChronoUnit.MICROS);
    }
}
