package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import java.time.LocalDate;
import java.util.Optional;
import java.util.regex.Pattern;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;

/** Closed, date-free count phrases can be answered without inference, even when AI is unavailable. */
final class AssistantStudentCountPlan {
    private static final Pattern TOTAL = Pattern.compile(
            "(?:how many students(?: do we have| are there)?|(?:what is |what's )?(?:the )?(?:total )?student count|"
            + "(?:我们|学校|全校)?(?:现在|目前)?(?:一共|总共)?(?:有)?多少(?:个|名)?学生|学生总数(?:是多少)?)[?？.!。！]*",
            Pattern.CASE_INSENSITIVE);

    private AssistantStudentCountPlan() { }

    static Optional<Plan> from(Question question) {
        if (!TOTAL.matcher(question.message().strip()).matches()) return Optional.empty();
        var today = LocalDate.now(AssistantText.ZONE);
        String language = question.message().codePoints().anyMatch(value -> Character.UnicodeScript.of(value) == Character.UnicodeScript.HAN)
                ? "zh" : "en";
        return Optional.of(new Plan(Intent.STUDENT_COUNT, "", "", today, today, false, language, "SOURCE_RECORDS"));
    }
}
