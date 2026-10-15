package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ReportSessionTimeTest {
    @Test void sameDayFutureStartsAndFutureLocalDatesAreExcludedDespiteCompletedFlag() {
        Instant asOf = Instant.parse("2026-10-11T23:00:00Z"); // 12 Oct noon in Auckland.
        var session = new ClassroomSession(); session.setStatus(ClassroomSession.SessionStatus.COMPLETED);
        session.setDate(LocalDate.of(2026, 10, 12)); session.setStartTime(asOf.plusSeconds(3600));
        assertThat(ReportSessionTime.completedBy(session, asOf)).isFalse();
        session.setStartTime(asOf.minusSeconds(3600));
        assertThat(ReportSessionTime.completedBy(session, asOf)).isTrue();
        session.setDate(LocalDate.of(2026, 10, 13));
        assertThat(ReportSessionTime.completedBy(session, asOf)).isFalse();
        session.setDate(LocalDate.of(2026, 10, 12)); session.setStatus(ClassroomSession.SessionStatus.SCHEDULED);
        assertThat(ReportSessionTime.completedBy(session, asOf)).isFalse();
    }
}
