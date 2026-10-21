package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;
import static org.assertj.core.api.Assertions.assertThat;

class AssistantStudentCountPlanTest {
    @Test void exactCurrentTotalQuestionsUseRecordsInBothLanguages() {
        for (var message : List.of("how many students do we have", "How many students are there?", "Total student count", "学校现在有多少学生？", "我们目前总共有多少名学生", "学生总数是多少？")) {
            var plan = AssistantStudentCountPlan.from(new Question(message, List.of(), null, null)).orElseThrow();
            assertThat(plan.intent()).isEqualTo(Intent.STUDENT_COUNT);
            assertThat(plan.provider()).isEqualTo("SOURCE_RECORDS");
            assertThat(plan.dateFrom()).isEqualTo(LocalDate.now(AssistantText.ZONE));
            assertThat(plan.dateTo()).isEqualTo(plan.dateFrom());
            assertThat(plan.studentQuery()).isEmpty(); assertThat(plan.courseQuery()).isEmpty();
            assertThat(plan.usePreviousStudent()).isFalse();
            assertThat(plan.language()).isEqualTo(message.contains("学生") ? "zh" : "en");
        }
    }
    @Test void filteredHistoricalCompoundAndWriteQuestionsNeverTriggerTheDirectCount() {
        for (var message : List.of("how many students do we have in COMPSCI 335", "how many active students do we have",
                "how many students do we have yesterday", "how many students do we have and delete Sam", "delete students",
                "去年有多少学生", "今天来了多少学生", "多少学生没付款", "学生总数是多少？然后批准注册")) {
            assertThat(AssistantStudentCountPlan.from(new Question(message, List.of(), null, null))).isEmpty();
        }
    }
}
