package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Frozen source projections. Never expose entity graphs or refill legacy documents from live records. */
public final class ReportSourceModels {
    private ReportSourceModels() { }
    public record Lesson(UUID sessionId, UUID courseOfferingId, String courseLabel, LocalDate date,
                         Instant startsAt, String status) { }
    public record Feedback(UUID id, String courseLabel, String teacherName, Instant recordedAt, String excerpt) { }
    public record Achievement(UUID id, String courseLabel, LocalDate date, String title, String category,
                              BigDecimal points) { }
    public record StudentSources(List<Lesson> lessons, List<Feedback> feedback, List<Achievement> achievements,
                                 int pendingCorrections) { }
    @JsonIgnoreProperties("followUps")
    public record ClassSources(List<Feedback> feedback) { }
}
