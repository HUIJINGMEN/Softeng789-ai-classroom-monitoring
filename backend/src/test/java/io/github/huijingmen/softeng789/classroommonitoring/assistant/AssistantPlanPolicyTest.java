package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;
import static org.assertj.core.api.Assertions.assertThat;

class AssistantPlanPolicyTest {
    private final LocalDate date = LocalDate.of(2026, 10, 5);
    private final Context context = new Context(Intent.ATTENDANCE, UUID.randomUUID(), "Ana", date, date, "");
    private Plan plan(Intent intent) {
        return new Plan(intent, "", "", date.plusDays(12), date.plusDays(12), true, "en", "QWEN:test");
    }
    @Test void chineseQuestionsNeverDependOnTheModelsLanguageChoice() {
        assertThat(AssistantPlanPolicy.apply(new Question("Ana 来了吗？", List.of(), null, null), plan(Intent.ATTENDANCE)).language()).isEqualTo("zh");
    }
    @Test void nextDayUsesSelectedSingleDateNotServerToday() {
        for (var message : List.of("那她第二天呢？", "次日呢", "What about the next day?")) {
            var result = AssistantPlanPolicy.apply(new Question(message, List.of(), context, null), plan(Intent.ATTENDANCE));
            assertThat(result.dateFrom()).isEqualTo(date.plusDays(1));
            assertThat(result.dateTo()).isEqualTo(date.plusDays(1));
        }
    }
    @Test void ambiguousRangeAndWriteRequestsNeverBecomeAllowedQueries() {
        var range = new Context(Intent.ATTENDANCE, context.studentId(), "Ana", date, date.plusDays(2), "");
        assertThat(AssistantPlanPolicy.apply(new Question("第二天呢？", List.of(), range, null), plan(Intent.ATTENDANCE)).intent()).isEqualTo(Intent.UNSUPPORTED);
        assertThat(AssistantPlanPolicy.apply(new Question("第二天呢？", List.of(), context, null), plan(Intent.UNSUPPORTED)).intent()).isEqualTo(Intent.UNSUPPORTED);
        assertThat(AssistantPlanPolicy.apply(new Question("明天呢？", List.of(), context, null), plan(Intent.ATTENDANCE)).dateFrom()).isEqualTo(date.plusDays(12));
    }
    @Test void explicitStudentReferencesPreserveSelectedIdentityWithoutReplacingAnotherNamedStudent() {
        var suggestion = new Plan(Intent.PAYMENTS,"Ana","",date,date,false,"en","QWEN:test");
        var result = AssistantPlanPolicy.apply(new Question("What is this student's current payment status?",List.of(),context,null),suggestion);
        assertThat(result.usePreviousStudent()).isTrue(); assertThat(result.studentQuery()).isEmpty();
        var another = new Plan(Intent.PAYMENTS,"Sam","",date,date,false,"en","QWEN:test");
        assertThat(AssistantPlanPolicy.apply(new Question("Is this student Sam?",List.of(),context,null),another).studentQuery()).isEqualTo("Sam");
    }
    @Test void genericPaymentReadAliasesCannotInheritHistoricalOrPersonalFilters() {
        for (var message : List.of("chack the payments stats","check the payment status","billing overview")) {
            var result = AssistantPlanPolicy.apply(new Question(message,List.of(),context,null),plan(Intent.UNSUPPORTED));
            assertThat(result.intent()).isEqualTo(Intent.PAYMENTS); assertThat(result.studentQuery()).isEmpty();
            assertThat(result.courseQuery()).isEmpty(); assertThat(result.usePreviousStudent()).isFalse();
            assertThat(result.dateFrom()).isEqualTo(LocalDate.now(AssistantText.ZONE));
        }
        for (var message : List.of("check payment stats last month","check payment status and approve it","delete payment status","check Sam payment status")) {
            assertThat(AssistantPlanPolicy.apply(new Question(message,List.of(),context,null),plan(Intent.UNSUPPORTED)).intent()).isEqualTo(Intent.UNSUPPORTED);
        }
    }
}
