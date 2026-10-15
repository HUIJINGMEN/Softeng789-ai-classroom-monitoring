package io.github.huijingmen.softeng789.classroommonitoring.reports;

import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

/** Audience is part of the stored scope. This edition deliberately contains no financial data. */
public final class OverallReportModels {
    private OverallReportModels() { }
    public enum Audience { INTERNAL, PARTNER }
    public record Scope(@NotNull LocalDate dateFrom, @NotNull LocalDate dateTo,
                        @NotNull Audience audience, @NotNull @Size(max = 100) List<@NotNull UUID> courseOfferingIds) { }
    public record CourseRow(UUID id, String code, String term, int students, int completedSessions,
                            AttendanceSummary attendance, int feedbackCount) { }
    public record Action(UUID courseOfferingId, String courseLabel, String issue, long count, String nextStep) { }
    public record CreditCount(String status, long count) { }
    public record RosterCourse(UUID id, String label) { }
    public record RosterStudent(UUID id, String name, String number, AttendanceSummary attendance, List<RosterCourse> courses) { }
    @JsonIgnoreProperties("studentDetails")
    public record Snapshot(Instant preparedAt, String preparedBy, boolean allCourses, int studentCount,
            int completedSessions, AttendanceSummary attendance, List<AttendancePoint> attendanceTrend,
            List<EventCount> confirmedEvents, List<CourseRow> courses, int feedbackCount, long achievements,
            List<CreditCount> creditDecisions, List<Action> actions,
            @JsonInclude(JsonInclude.Include.NON_NULL) List<RosterStudent> students) {
        public Snapshot(Instant preparedAt, String preparedBy, boolean allCourses, int studentCount,
                int completedSessions, AttendanceSummary attendance, List<AttendancePoint> attendanceTrend,
                List<EventCount> confirmedEvents, List<CourseRow> courses, int feedbackCount, long achievements,
                List<CreditCount> creditDecisions, List<Action> actions) {
            this(preparedAt, preparedBy, allCourses, studentCount, completedSessions, attendance, attendanceTrend,
                    confirmedEvents, courses, feedbackCount, achievements, creditDecisions, actions, null);
        }
    }
    public record Document(LocalDate dateFrom, LocalDate dateTo, Audience audience, List<UUID> courseOfferingIds,
                           List<Section> sections, Snapshot snapshot) { }
    public record View(UUID id, long version, Instant createdAt, Instant finalizedAt,
                       String privacyReviewedBy, Instant privacyReviewedAt, Document document) { }
    public record Finalize(@NotNull Long version, boolean privacyReviewed) { }
}
