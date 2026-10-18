package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import java.time.Instant;
import io.github.huijingmen.softeng789.classroommonitoring.service.AttendanceMetricPolicy;

/** A premature COMPLETED flag must not turn a future lesson into report evidence. */
final class ReportSessionTime {
    private ReportSessionTime() { }

    static boolean completedBy(ClassroomSession session, Instant asOf) {
        return AttendanceMetricPolicy.completedBy(session, asOf);
    }
}
