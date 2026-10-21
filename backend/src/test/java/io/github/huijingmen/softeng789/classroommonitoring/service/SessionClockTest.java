package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class SessionClockTest {
    @Test
    void winterAndSummerLocalClocksRoundTripThroughRealUtc() {
        assertRoundTrip("2026-07-14", "10:00", "2026-07-13T22:00:00Z");
        assertRoundTrip("2026-10-14", "10:00", "2026-10-13T21:00:00Z");
        assertRoundTrip("2026-10-14", "14:00", "2026-10-14T01:00:00Z");
        assertRoundTrip("2026-10-14", "23:00", "2026-10-14T10:00:00Z");
        assertRoundTrip("2026-09-26", "10:00", "2026-09-25T22:00:00Z");
        assertRoundTrip("2026-09-27", "10:00", "2026-09-26T21:00:00Z");
        assertRoundTrip("2027-04-03", "10:00", "2027-04-02T21:00:00Z");
        assertRoundTrip("2027-04-04", "10:00", "2027-04-03T22:00:00Z");
    }

    @Test
    void rejectsMissingAndRepeatedDaylightSavingClocks() {
        for (String day : new String[]{"2026-09-27", "2027-04-04"}) {
            assertThatThrownBy(() -> SessionClock.instant(LocalDate.parse(day), LocalTime.of(2, 30)))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("daylight-saving");
        }
    }

    @Test
    void explicitContractDistinguishesLegacyDigitsFromCanonicalInstants() {
        Instant canonical = Instant.parse("2026-10-13T21:00:00Z");
        assertThat(SessionClock.requestInstant(canonical, "Pacific/Auckland")).isEqualTo(canonical);
        assertThat(SessionClock.requestInstant(Instant.parse("2026-10-14T10:00:00Z"), null)).isEqualTo(canonical);
        assertThatThrownBy(() -> SessionClock.requestInstant(canonical, "UTC"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Pacific/Auckland");
    }

    @Test
    void rangeUsesSchoolDateInsteadOfUtcDateAndRejectsOvernightOrReversedTimes() {
        LocalDate date = LocalDate.parse("2026-10-14");
        Instant start = Instant.parse("2026-10-13T21:00:00Z");
        Instant end = Instant.parse("2026-10-14T01:00:00Z");
        assertThatCode(() -> SessionClock.requireValidRange(date, start, end)).doesNotThrowAnyException();
        assertThatThrownBy(() -> SessionClock.requireValidRange(date.minusDays(1), start, end))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Session date");
        assertThatThrownBy(() -> SessionClock.requireValidRange(date, end, start))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("after start");
    }

    private void assertRoundTrip(String day, String clock, String utc) {
        var actual = SessionClock.instant(LocalDate.parse(day), LocalTime.parse(clock));
        assertThat(actual).isEqualTo(Instant.parse(utc));
        assertThat(SessionClock.localTime(actual)).isEqualTo(LocalTime.parse(clock));
        assertThat(actual.atZone(SessionClock.AUCKLAND).toLocalDate()).isEqualTo(LocalDate.parse(day));
    }
}
