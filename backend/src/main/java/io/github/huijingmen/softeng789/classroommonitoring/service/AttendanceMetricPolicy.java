package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import java.time.Instant;

/** Shared evidence/rate boundary. Missing marks are completeness data, never absences. */
public final class AttendanceMetricPolicy {
    private AttendanceMetricPolicy() { }

    public static boolean recorded(AttendanceStatus status) {
        return status == AttendanceStatus.PRESENT || status == AttendanceStatus.LATE
                || status == AttendanceStatus.ABSENT;
    }

    public static Integer rate(long attended, long recorded) {
        if (attended < 0 || recorded < 0 || attended > recorded) {
            throw new IllegalArgumentException("Attendance counts must satisfy 0 <= attended <= recorded.");
        }
        return recorded == 0 ? null : (int) Math.round(100.0 * attended / recorded);
    }

    /** A future or premature COMPLETED flag must not become historical evidence. */
    public static boolean completedBy(ClassroomSession session, Instant asOf) {
        return session != null && session.getStatus() == ClassroomSession.SessionStatus.COMPLETED
                && session.getDate() != null
                && !session.getDate().isAfter(asOf.atZone(SessionClock.AUCKLAND).toLocalDate())
                && session.getStartTime() != null && !session.getStartTime().isAfter(asOf);
    }
}
