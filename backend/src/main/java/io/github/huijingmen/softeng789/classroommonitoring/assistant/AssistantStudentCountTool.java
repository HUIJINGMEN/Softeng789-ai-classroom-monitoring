package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantText.*;

/** Aggregate distinct student records, never enrolment rows or a capped student search. */
@Component
class AssistantStudentCountTool implements AssistantTool {
    private final EntityManager records;

    AssistantStudentCountTool(EntityManager records) { this.records = records; }

    @Override public Set<Intent> intents() { return Set.of(Intent.STUDENT_COUNT); }

    @Override public ToolResult query(Plan plan, Student student) {
        var today = LocalDate.now(ZONE);
        if (student != null || !plan.studentQuery().isBlank() || plan.usePreviousStudent() || !plan.courseQuery().isBlank()
                || !today.equals(plan.dateFrom()) || !today.equals(plan.dateTo())) {
            return new ToolResult(text(plan,
                    "学生人数目前支持全校当前统计，不支持按课程、个人或历史日期筛选。请问：学校现在有多少学生？",
                    "Student counts currently cover the whole institution now, not individual students, courses or historical dates. Ask: How many students do we have?"), List.of(), false);
        }
        Object[] totals = records.createQuery("""
                select
                  coalesce(sum(case when s.approvalStatus = 'APPROVED' then 1 else 0 end), 0),
                  coalesce(sum(case when s.approvalStatus = 'APPROVED' and s.status = 'ACTIVE' then 1 else 0 end), 0),
                  coalesce(sum(case when s.approvalStatus = 'APPROVED' and s.status = 'WITHDRAWN' then 1 else 0 end), 0),
                  coalesce(sum(case when s.approvalStatus = 'PENDING' then 1 else 0 end), 0)
                from Student s
                """, Object[].class).getSingleResult();
        String message = text(plan,
                "目前有 %s 名已审核学生：%s 名在读，%s 名已退学。另有 %s 条待审核注册，未计入学生总数。按学生档案统计，每位学生只算一次，与选课次数无关；这是当前快照，不是历史人数。",
                "There are currently %s approved students: %s active and %s withdrawn. Another %s registrations are pending approval and are excluded from that total. Each student record is counted once, regardless of course enrolments. This is a current snapshot, not a historical headcount.")
                .formatted(totals[0], totals[1], totals[2], totals[3]);
        return new ToolResult(message, List.of(), false);
    }
}
