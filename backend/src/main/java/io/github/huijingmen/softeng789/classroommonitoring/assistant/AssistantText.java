package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionClock;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;

final class AssistantText {
    static final ZoneId ZONE = ZoneId.of("Pacific/Auckland");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    private AssistantText() { }
    static String text(Plan plan, String zh, String en) { return "zh".equals(plan.language()) ? zh : en; }
    static String lesson(ClassroomSession session) {
        return session.getCourseOffering().getCourse().getCode() + " · " + session.getCourseOffering().getAcademicTerm();
    }
    static String when(ClassroomSession session) { return session.getDate() + " · " + TIME.format(SessionClock.localTime(session.getStartTime())); }
    static Fact fact(Plan plan, String zh, String en, Object value) { return new Fact(text(plan, zh, en), String.valueOf(value)); }
}
