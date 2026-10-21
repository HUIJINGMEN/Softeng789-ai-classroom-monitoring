package io.github.huijingmen.softeng789.classroommonitoring.vision;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class CheckInSessionTimeTest {
    @Test void teacher1610IsStudent1610OnTheSameAucklandDate() {
        var start = Instant.parse("2026-10-19T16:10:00Z");
        var end = Instant.parse("2026-10-19T17:05:00Z");
        assertThat(CheckInSessionTime.actual(start)).isEqualTo(Instant.parse("2026-10-19T03:10:00Z"));
        assertThat(CheckInSessionTime.actual(end)).isEqualTo(Instant.parse("2026-10-19T04:05:00Z"));
        assertThat(CheckInSessionTime.withinWindow(start, end, Instant.parse("2026-10-19T02:54:59Z"))).isFalse();
        assertThat(CheckInSessionTime.withinWindow(start, end, Instant.parse("2026-10-19T02:55:00Z"))).isTrue();
        assertThat(CheckInSessionTime.withinWindow(start, end, Instant.parse("2026-10-19T04:04:59Z"))).isTrue();
        assertThat(CheckInSessionTime.withinWindow(start, end, Instant.parse("2026-10-19T04:05:00Z"))).isFalse();
    }
    @Test void winterUsesTwelveHoursAndMorningCanFallOnPreviousUtcDate() {
        assertThat(CheckInSessionTime.actual(Instant.parse("2026-07-19T16:10:00Z")))
                .isEqualTo(Instant.parse("2026-07-19T04:10:00Z"));
        var stored = Instant.parse("2026-10-19T09:00:00Z");
        assertThat(CheckInSessionTime.actual(stored)).isEqualTo(Instant.parse("2026-10-18T20:00:00Z"));
        assertThat(CheckInSessionTime.stored(CheckInSessionTime.actual(stored))).isEqualTo(stored);
    }
    @Test void daylightSavingChangeIsResolvedPerSessionDate() {
        assertThat(CheckInSessionTime.actual(Instant.parse("2026-09-26T16:10:00Z")))
                .isEqualTo(Instant.parse("2026-09-26T04:10:00Z"));
        assertThat(CheckInSessionTime.actual(Instant.parse("2026-09-27T16:10:00Z")))
                .isEqualTo(Instant.parse("2026-09-27T03:10:00Z"));
    }
}
