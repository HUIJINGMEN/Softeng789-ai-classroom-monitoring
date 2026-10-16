package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantText.*;

@Component
class AssistantScheduleTool implements AssistantTool {
    private final AssistantLessonQueries lessons;
    AssistantScheduleTool(AssistantLessonQueries lessons) { this.lessons = lessons; }
    public Set<Intent> intents() { return Set.of(Intent.SCHEDULE); }
    public ToolResult query(Plan plan, Student student) {
        var data = lessons.find(plan, student);
        var rows = data.sessions().stream().limit(50).map(session -> new AnswerRow(session.getId().toString(), lesson(session), when(session),
                session.getStatus().name(), List.of(fact(plan, "地点", "Room", session.getRoom()),
                fact(plan, "老师", "Teacher", session.getTeacher() == null ? text(plan, "未分配", "Unassigned") : session.getTeacher().getName())),
                new Source(SourceType.SESSION, session.getId()))).toList();
        return new ToolResult(text(plan, "查询到 " + data.sessions().size() + " 个课次。时间均为奥克兰当地时间；已取消课次不表示实际上课。",
                "Found " + data.sessions().size() + " lessons. All times are Auckland local time; cancelled lessons did not take place."),
                rows, data.truncated() || data.sessions().size() > 50);
    }
}
