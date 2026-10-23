package io.github.huijingmen.softeng789.classroommonitoring.vision;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class CheckInSessionTimeTest {
    @Test void trueUtcInstantsHaveAnInclusiveOpeningAndExclusiveEnd() {
        var start = Instant.parse("2026-10-19T03:10:00Z"); // 16:10 Auckland
        var end = Instant.parse("2026-10-19T04:05:00Z");
        assertThat(CheckInSessionTime.withinWindow(start, end, start.minusSeconds(901))).isFalse();
        assertThat(CheckInSessionTime.withinWindow(start, end, start.minusSeconds(900))).isTrue();
        assertThat(CheckInSessionTime.withinWindow(start, end, start)).isTrue();
        assertThat(CheckInSessionTime.withinWindow(start, end, end.minusSeconds(1))).isTrue();
        assertThat(CheckInSessionTime.withinWindow(start, end, end)).isFalse();
    }
    @Test void winterSummerAndDstDatesUseTheTimetablesActualInstantWithoutAnotherShift() {
        for (String day : new String[]{"2026-07-19", "2026-10-19", "2026-09-26", "2026-09-27"}) {
            Instant start = LocalDateTime.parse(day + "T16:10:00").atZone(ZoneId.of("Pacific/Auckland")).toInstant();
            assertThat(CheckInSessionTime.withinWindow(start, start.plusSeconds(3300), start)).isTrue();
            assertThat(CheckInSessionTime.withinWindow(start, start.plusSeconds(3300), start.minusSeconds(12 * 3600))).isFalse();
        }
    }
}
