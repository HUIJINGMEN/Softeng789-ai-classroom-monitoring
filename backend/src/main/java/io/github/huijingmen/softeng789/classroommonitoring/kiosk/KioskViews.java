package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import java.time.Instant;
import java.util.*;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;

final class KioskViews {
    private KioskViews() {}
    static Map<String, Object> fields(Object... pairs) {
        var result = new LinkedHashMap<String, Object>() {
            @Override public String toString() { return "[redacted kiosk response]"; }
        };
        for (int i = 0; i < pairs.length; i += 2) result.put((String) pairs[i], pairs[i + 1]);
        return result;
    }
    static String label(ClassroomSession session) {
        return session.getCourseOffering() == null ? session.getCourse() : session.getCourseOffering().getOfferingCode();
    }
    static String window(ClassroomSession session, Instant now) {
        if (!Set.of(ClassroomSession.SessionStatus.SCHEDULED, ClassroomSession.SessionStatus.ACTIVE).contains(session.getStatus())
                || !now.isBefore(session.getEndTime())) return "CLOSED";
        return now.isBefore(session.getStartTime().minusSeconds(900)) ? "WAITING" : "OPEN";
    }
}
