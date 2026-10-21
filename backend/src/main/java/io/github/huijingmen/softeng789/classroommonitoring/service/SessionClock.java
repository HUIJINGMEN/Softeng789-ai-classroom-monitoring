package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** School-local dates/clocks at the boundary; real UTC instants in storage and comparisons. */
public final class SessionClock {
    public static final ZoneId AUCKLAND = ZoneId.of("Pacific/Auckland");
    private SessionClock() { }

    public static LocalTime localTime(Instant value) {
        return value.atZone(AUCKLAND).toLocalTime();
    }

    public static Instant instant(LocalDate date, LocalTime time) {
        LocalDateTime local = date.atTime(time);
        var offsets = AUCKLAND.getRules().getValidOffsets(local);
        if (offsets.size() != 1) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "This Auckland time is missing or occurs twice during a daylight-saving change. Choose another time.");
        }
        return local.toInstant(offsets.getFirst());
    }

    /** Missing timeZone is the old client's UTC-digit wall clock, never an inference from dates. */
    public static Instant requestInstant(Instant value, String timeZone) {
        if (timeZone == null) {
            var legacy = value.atOffset(ZoneOffset.UTC);
            return instant(legacy.toLocalDate(), legacy.toLocalTime());
        }
        if (!AUCKLAND.getId().equals(timeZone)) {
            throw new ResponseStatusException(BAD_REQUEST, "Session timeZone must be Pacific/Auckland.");
        }
        return value;
    }

    public static void requireValidRange(LocalDate date, Instant start, Instant end) {
        if (!end.isAfter(start)) {
            throw new ResponseStatusException(BAD_REQUEST, "Session end time must be after start time.");
        }
        if (!date.equals(start.atZone(AUCKLAND).toLocalDate())
                || !date.equals(end.atZone(AUCKLAND).toLocalDate())) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Session date must match the start and end dates in Pacific/Auckland.");
        }
        // Scheduling accepts one unambiguous local clock, including requests using explicit instants.
        instant(date, start.atZone(AUCKLAND).toLocalTime());
        instant(date, end.atZone(AUCKLAND).toLocalTime());
    }
}
