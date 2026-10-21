package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import java.util.regex.Pattern;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;

/** Deterministic presentation and narrowly defined temporal follow-ups, independent of inference. */
final class AssistantPlanPolicy {
    private static final Pattern NEXT_DAY = Pattern.compile(
            "^(?:那|那么)?(?:他|她|该学生)?(?:第二天|次日)(?:呢|怎么样)?[？?。.!！]*$|^(?:and |what about )?(?:the )?next day[?!.]*$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern STUDENT_REFERENCE = Pattern.compile("该学生|这位学生|\\bthis student\\b|\\btheir\\b|\\bhis\\b|\\bher\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern CURRENT_PAYMENTS = Pattern.compile(
            "(?:(?:check|chack|show|view)\\s+(?:the\\s+)?)?(?:payments?\\s+(?:status|stats|statistics)|billing\\s+overview)[?.!]*",
            Pattern.CASE_INSENSITIVE);

    private AssistantPlanPolicy() { }

    static Plan apply(Question question, Plan plan) {
        String language = question.message().codePoints().anyMatch(value -> Character.UnicodeScript.of(value) == Character.UnicodeScript.HAN)
                ? "zh" : "en";
        // These exact, date-free read phrases mean current balances, not an old student's historical scope.
        // The closed grammar deliberately excludes names, dates, compound requests and write verbs.
        if (CURRENT_PAYMENTS.matcher(question.message().strip()).matches()) {
            var today = java.time.LocalDate.now(AssistantText.ZONE);
            return new Plan(Intent.PAYMENTS, "", "", today, today, false, language, plan.provider());
        }
        var from = plan.dateFrom();
        var to = plan.dateTo();
        var intent = plan.intent();
        var context = question.context();
        if (context != null && NEXT_DAY.matcher(question.message().strip()).matches()) {
            if (context.dateFrom().equals(context.dateTo())) {
                from = context.dateFrom().plusDays(1);
                to = from;
            } else {
                intent = Intent.UNSUPPORTED; // A range has no unambiguous "next day".
            }
        }
        String studentQuery = plan.studentQuery();
        boolean previous = plan.usePreviousStudent();
        if (context != null && context.studentId() != null && STUDENT_REFERENCE.matcher(question.message()).find()
                && (studentQuery.isBlank() || studentQuery.equalsIgnoreCase(context.studentName()))) {
            studentQuery = "";
            previous = true;
        }
        return new Plan(intent, studentQuery, plan.courseQuery(), from, to,
                previous, language, plan.provider());
    }
}
