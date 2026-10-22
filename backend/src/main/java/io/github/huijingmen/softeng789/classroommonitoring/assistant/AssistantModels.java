package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class AssistantModels {
    private AssistantModels() { }
    public enum Intent { ATTENDANCE, ABSENCES, SCHEDULE, PAYMENTS, PAYMENT_REVIEW, STUDENT_COUNT, UNSUPPORTED }
    public enum SourceType { STUDENT, SESSION, PAYMENTS }
    public record Context(@NotNull Intent intent, UUID studentId, @NotNull @Size(max=160) String studentName,
                          @NotNull LocalDate dateFrom, @NotNull LocalDate dateTo, @NotNull @Size(max=120) String courseQuery) { }
    public record Question(@NotBlank @Size(max=1000) String message,
                           @Size(max=4) List<@NotBlank @Size(max=1000) String> history,
                           @Valid Context context, UUID selectedStudentId,
                           @Size(min=1, max=120) String studentSearch) {
        public Question(String message, List<String> history, Context context, UUID selectedStudentId) {
            this(message, history, context, selectedStudentId, null);
        }
    }
    public record PlannerContext(Intent intent, String studentName, LocalDate dateFrom, LocalDate dateTo, String courseQuery) { }
    public record PlannerRequest(String message, LocalDate today, List<String> history, PlannerContext context) { }
    public record Plan(@NotNull Intent intent, @NotNull @Size(max=120) String studentQuery,
                       @NotNull @Size(max=120) String courseQuery, @NotNull LocalDate dateFrom,
                       @NotNull LocalDate dateTo, boolean usePreviousStudent,
                       @NotNull @Pattern(regexp="zh|en") String language, @NotBlank @Size(max=160) String provider) { }
    public record Fact(String label, String value) { }
    public record Source(SourceType type, UUID id) { }
    public record AnswerRow(String id, String title, String subtitle, String status, List<Fact> facts, Source source) { }
    public record Choice(UUID id, String name, String number) { }
    public record ToolResult(String message, List<AnswerRow> rows, boolean truncated) { }
    public record Answer(String status, String message, Intent intent, String language,
                         LocalDate dateFrom, LocalDate dateTo, Instant asOf,
                         List<AnswerRow> rows, List<Choice> choices, Context context,
                         String provider, boolean truncated) { }
}
