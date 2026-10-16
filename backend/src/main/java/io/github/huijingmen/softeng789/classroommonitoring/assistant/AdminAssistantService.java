package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantText.*;

@Service
public class AdminAssistantService {
    private final SessionAuthService auth;
    private final AssistantPlannerGateway planner;
    private final AssistantStudentLookup lookup;
    private final Map<Intent, AssistantTool> tools = new EnumMap<>(Intent.class);
    private final Set<UUID> running = ConcurrentHashMap.newKeySet();
    private final TransactionTemplate reads;
    public AdminAssistantService(SessionAuthService auth, AssistantPlannerGateway planner, AssistantStudentLookup lookup,
            List<AssistantTool> toolList, PlatformTransactionManager transactions) {
        this.auth = auth; this.planner = planner; this.lookup = lookup;
        this.reads = new TransactionTemplate(transactions);
        reads.setReadOnly(true);
        toolList.forEach(tool -> tool.intents().forEach(intent -> {
            if (tools.putIfAbsent(intent, tool) != null) throw new IllegalStateException("Duplicate assistant tool: " + intent);
        }));
    }
    public Answer ask(Question question, String authorization) {
        UUID caller = auth.requireAdmin(authorization);
        if (!running.add(caller)) throw new ResponseStatusException(TOO_MANY_REQUESTS, "Please wait for your current question to finish.");
        try {
            var plan = plan(question);
            auth.requireAdmin(authorization); // Re-check a session revoked while inference was running.
            validate(plan);
            return reads.execute(status -> answer(question, plan));
        } finally { running.remove(caller); }
    }
    private Plan plan(Question question) {
        if (question.studentSearch() != null) return AssistantClarificationPlan.from(question);
        var count = AssistantStudentCountPlan.from(question);
        if (count.isPresent()) return count.get();
        var context = question.context();
        var hint = context == null ? null : new PlannerContext(context.intent(), context.studentName(), context.dateFrom(), context.dateTo(), context.courseQuery());
        // Inference must not hold a database connection or a transaction open.
        return AssistantPlanPolicy.apply(question, planner.plan(new PlannerRequest(question.message(), LocalDate.now(ZONE),
                question.history() == null ? List.of() : question.history(), hint)));
    }
    private void validate(Plan plan) {
        if (plan.dateTo().isBefore(plan.dateFrom()) || ChronoUnit.DAYS.between(plan.dateFrom(), plan.dateTo()) > 30)
            throw new ResponseStatusException(BAD_REQUEST, "Choose a date range of at most 31 days.");
    }
    private Answer answer(Question question, Plan plan) {
        if (!tools.containsKey(plan.intent())) return result(plan, "UNSUPPORTED", text(plan,
                "暂不支持这个问题。可以查询学生总数，或选择下方的考勤、课表或当前付款查询。请一次问一个具体问题。助手不会修改记录、发送消息或统计历史收款。",
                "This question is not supported yet. Ask for the student count, or choose an attendance, timetable or current-payment query below. Ask one specific question at a time. I cannot change records, send messages or total historical receipts."), null, List.of(), List.of(), false);
        var resolution = lookup.resolve(question, plan);
        if (resolution.clarify()) return result(plan, "CLARIFY", clarification(plan, resolution.choices().isEmpty()),
                null, List.of(), resolution.choices(), resolution.truncated());
        var student = resolution.student();
        if (plan.intent() == Intent.ATTENDANCE && student == null) return result(plan, "CLARIFY", text(plan,
                "你想查询哪位学生？请输入姓名或学号。", "Which student should I check? Enter their name or student number."), null, List.of(), List.of(), false);
        var queried = tools.get(plan.intent()).query(plan, student);
        return result(plan, "ANSWER", queried.message(), student, queried.rows(), List.of(), queried.truncated());
    }
    private String clarification(Plan plan, boolean noMatch) {
        return text(plan, noMatch ? "没有找到匹配的学生，请输入完整姓名或学号。" : "有多个匹配的学生，请先选择一位；如果不在列表中，请输入完整学号。",
                noMatch ? "No student matched. Please enter a full name or student number." : "Several students match. Select one, or enter the full student number.");
    }
    private Answer result(Plan plan, String status, String message, Student student, List<AnswerRow> rows, List<Choice> choices, boolean truncated) {
        var context = new Context(plan.intent(), student == null ? null : student.getId(), student == null ? "" : student.getFullName(),
                plan.dateFrom(), plan.dateTo(), plan.courseQuery());
        return new Answer(status, message, plan.intent(), plan.language(), plan.dateFrom(), plan.dateTo(), Instant.now(),
                rows, choices, context, plan.provider(), truncated);
    }
}
