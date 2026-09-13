package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Honest deterministic fallback: it creates a useful review draft but is never presented as a
 * production AI result. Folds every feedback note into each field (not just whichever one or two
 * happen to be most recent) so the draft actually reflects the whole period a teacher selected,
 * not an arbitrary excerpt of it — a real summarizer paraphrases instead of concatenating, but
 * until one is wired in, showing everything is more honest than showing a random slice of it. */
@Component
@ConditionalOnProperty(
        name = "ai.feedback-summary.provider",
        havingValue = "demo",
        matchIfMissing = true
)
public class DemoFeedbackSummaryGateway implements FeedbackSummaryGateway {
    @Override
    public GeneratedSummary summarize(
            String studentName,
            String classLabel,
            LocalDate dateFrom,
            LocalDate dateTo,
            List<String> feedback
    ) {
        List<String> notes = feedback.stream()
                .map(this::clean)
                .filter(value -> !value.isBlank())
                .toList();

        String intro = studentName + " has " + notes.size() + " recorded feedback note"
                + (notes.size() == 1 ? "" : "s") + " for " + classLabel + " during this period.";
        String summary = limit(intro + " " + String.join(" ", notes), 480);

        String strengths = joinOrFallback(
                notes.stream().filter(this::soundsPositive).toList(),
                "The available teacher observations show ongoing participation and progress."
        );

        String nextSteps = joinOrFallback(
                notes.stream().filter(this::soundsActionable).toList(),
                "Continue the current work and review the next learning goal with the teacher."
        );
        return new GeneratedSummary(summary, strengths, nextSteps, "DEMO");
    }

    private String joinOrFallback(List<String> sentences, String fallback) {
        return sentences.isEmpty() ? fallback : limit(String.join(" ", sentences), 320);
    }

    private boolean soundsPositive(String value) {
        String lower = value.toLowerCase();
        return lower.contains("good") || lower.contains("strong") || lower.contains("clear")
                || lower.contains("progress") || lower.contains("consistent") || lower.contains("contributed");
    }

    private boolean soundsActionable(String value) {
        String lower = value.toLowerCase();
        return lower.contains("next") || lower.contains("review") || lower.contains("improve")
                || lower.contains("needs") || lower.contains("please") || lower.contains("revisit");
    }

    private String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String limit(String value, int max) {
        if (value.length() <= max) return value;
        return value.substring(0, max - 1).stripTrailing() + "…";
    }
}
