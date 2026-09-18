package io.github.huijingmen.softeng789.classroommonitoring.support;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Produces timestamps at the precision shared by PostgreSQL and the H2 test database.
 *
 * <p>Java {@link Instant} values can contain nanoseconds, while database timestamp columns retain
 * microseconds. Normalising before an entity is returned keeps an immediate API response identical
 * to the value read back from the database later.</p>
 */
public final class PersistenceTime {
    private PersistenceTime() {
    }

    public static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }
}
