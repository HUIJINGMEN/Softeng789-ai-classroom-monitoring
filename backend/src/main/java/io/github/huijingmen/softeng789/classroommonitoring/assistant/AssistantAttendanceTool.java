package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import java.util.*;
import org.springframework.stereotype.Component;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantText.*;

@Component
class AssistantAttendanceTool implements AssistantTool {
    private final AssistantLessonQueries lessons;
    AssistantAttendanceTool(AssistantLessonQueries lessons) { this.lessons = lessons; }
    public Set<Intent> intents() { return Set.of(Intent.ATTENDANCE, Intent.ABSENCES); }
    public ToolResult query(Plan plan, Student student) {
        var data = lessons.find(plan, student);
        if (plan.intent() == Intent.ABSENCES) return absences(plan, student, data);
        var marks = new HashMap<UUID, AttendanceRecord>();
        data.marks().stream().filter(row -> row.getStudent().getId().equals(student.getId()))
                .forEach(row -> marks.put(row.getSession().getId(), row));
        var rows = data.sessions().stream().map(lesson -> row(plan, lesson, student, status(lesson, marks.get(lesson.getId())))).toList();
        long attended = rows.stream().filter(row -> row.status().equals("PRESENT") || row.status().equals("LATE")).count();
        long absent = rows.stream().filter(row -> row.status().equals("ABSENT")).count();
        long unknown = rows.stream().filter(row -> row.status().equals("NOT_RECORDED")).count();
        String message = rows.isEmpty() ? text(plan, student.getFullName() + " 在所选日期和课程范围内没有适用的课次；这不表示缺勤。",
                student.getFullName() + " has no applicable lessons in these dates and courses. This is not an absence.")
                : text(plan, student.getFullName() + "：已记录出席/迟到 " + attended + " 节，缺勤 " + absent + " 节，未记录 " + unknown + " 节。未来或已取消课次单独列出。",
                student.getFullName() + ": " + attended + " present/late, " + absent + " absent and " + unknown + " not recorded. Upcoming and cancelled lessons are shown separately.");
        return new ToolResult(message, rows.stream().limit(50).toList(), data.truncated() || rows.size() > 50);
    }
    private ToolResult absences(Plan plan, Student student, AssistantLessonQueries.Lessons data) {
        var sessions = new HashMap<UUID, ClassroomSession>();
        data.sessions().stream().filter(AssistantLessonQueries::started).forEach(row -> sessions.put(row.getId(), row));
        var absent = data.marks().stream().filter(mark -> sessions.containsKey(mark.getSession().getId()))
                .filter(mark -> student == null || mark.getStudent().getId().equals(student.getId()))
                .filter(mark -> mark.getStatus() == AttendanceRecord.AttendanceStatus.ABSENT)
                .sorted(Comparator.comparing((AttendanceRecord mark) -> mark.getSession().getStartTime())
                        .thenComparing(mark -> mark.getStudent().getFullName())).toList();
        long people = absent.stream().map(mark -> mark.getStudent().getId()).distinct().count();
        long missing = missing(data, student);
        var rows = absent.stream().limit(50).map(mark -> row(plan, mark.getSession(), mark.getStudent(), "ABSENT")).toList();
        return new ToolResult(text(plan, "查询到 " + people + " 位学生、" + absent.size() + " 条已记录缺勤。另外有 " + missing + " 条已结束课次的考勤未记录，不算缺勤。",
                people + " distinct students have " + absent.size() + " recorded absence marks. Another " + missing + " completed-lesson marks are not recorded; they are not absences."),
                rows, data.truncated() || absent.size() > 50);
    }
    private long missing(AssistantLessonQueries.Lessons data, Student student) {
        long missing = 0;
        for (var lesson : data.sessions()) {
            if (!AssistantLessonQueries.started(lesson) || lesson.getStatus() != ClassroomSession.SessionStatus.COMPLETED
                    || lesson.getEndTime().isAfter(java.time.Instant.now())) continue;
            var expected = new HashSet<UUID>();
            data.enrolments().stream().filter(entry -> AssistantLessonQueries.applies(entry, lesson))
                    .filter(entry -> student == null || entry.getStudent().getId().equals(student.getId()))
                    .forEach(entry -> expected.add(entry.getStudent().getId()));
            var marks = data.marks().stream().filter(mark -> mark.getSession().getId().equals(lesson.getId()))
                    .filter(mark -> student == null || mark.getStudent().getId().equals(student.getId())).toList();
            marks.forEach(mark -> expected.add(mark.getStudent().getId()));
            marks.stream().filter(mark -> mark.getStatus() != AttendanceRecord.AttendanceStatus.UNKNOWN)
                    .forEach(mark -> expected.remove(mark.getStudent().getId()));
            missing += expected.size();
        }
        return missing;
    }
    private String status(ClassroomSession lesson, AttendanceRecord mark) {
        if (lesson.getStatus() == ClassroomSession.SessionStatus.CANCELLED) return "CANCELLED";
        if (!AssistantLessonQueries.started(lesson)) return "SCHEDULED";
        return mark == null || mark.getStatus() == AttendanceRecord.AttendanceStatus.UNKNOWN ? "NOT_RECORDED" : mark.getStatus().name();
    }
    private AnswerRow row(Plan plan, ClassroomSession lesson, Student student, String status) {
        return new AnswerRow(lesson.getId() + "/" + student.getId(), student.getFullName(), student.getStudentNumber(), status,
                List.of(fact(plan, "课程", "Course", lesson(lesson)), fact(plan, "课次", "Lesson", when(lesson))),
                new Source(SourceType.SESSION, lesson.getId()));
    }
}
