package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import java.util.Set;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;

/** Implementations execute bounded read-only queries within the coordinator's read transaction. */
public interface AssistantTool {
    Set<Intent> intents();
    ToolResult query(Plan plan, Student student);
}
