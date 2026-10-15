package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import java.time.Instant;
import java.time.ZoneId;

/** A premature COMPLETED flag must not turn a future lesson into report evidence. */
final class ReportSessionTime {
    private static final ZoneId ZONE = ZoneId.of("Pacific/Auckland");
    private ReportSessionTime() { }

    static boolean completedBy(ClassroomSession session, Instant asOf) {
        return session.getStatus() == ClassroomSession.SessionStatus.COMPLETED
                && !session.getDate().isAfter(asOf.atZone(ZONE).toLocalDate())
                && session.getStartTime() != null && !session.getStartTime().isAfter(asOf);
    }
}
