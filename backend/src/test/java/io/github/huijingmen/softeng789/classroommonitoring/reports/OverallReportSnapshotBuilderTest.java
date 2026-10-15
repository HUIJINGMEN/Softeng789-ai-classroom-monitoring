package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Scope;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static org.assertj.core.api.Assertions.assertThat;

class OverallReportSnapshotBuilderTest {
    private final UUID sharedStudent = UUID.randomUUID();
    private final UUID otherStudent = UUID.randomUUID();
    private final Instant preparedAt = Instant.parse("2026-10-15T00:00:00Z");
    private final LocalDate week = LocalDate.of(2026, 10, 5);

    @Test void assemblyDeduplicatesStudentsAndWeightsRawMarksWithoutRepositories() {
        var snapshot = OverallReportSnapshotBuilder.build(courses(), scope(Audience.INTERNAL), preparedAt, "Reviewer");
        assertThat(snapshot.studentCount()).isEqualTo(2);
        assertThat(snapshot.completedSessions()).isEqualTo(7);
        assertThat(snapshot.attendance()).isEqualTo(new AttendanceSummary(8, 3, 1, 2, 2, 67));
        assertThat(snapshot.attendanceTrend()).containsExactly(new AttendancePoint(week, snapshot.attendance()));
        assertThat(snapshot.confirmedEvents()).containsExactly(new EventCount("DISCUSSION", 5));
        assertThat(snapshot.feedbackCount()).isEqualTo(2);
        assertThat(snapshot.achievements()).isEqualTo(3);
        assertThat(snapshot.students()).hasSize(2);
        var shared = snapshot.students().stream().filter(row -> row.id().equals(sharedStudent)).findFirst().orElseThrow();
        assertThat(shared.courses()).hasSize(2);
        assertThat(shared.attendance()).isEqualTo(new AttendanceSummary(6, 3, 1, 1, 1, 80));
        assertThat(snapshot.creditDecisions()).containsExactly(new CreditCount("AVAILABLE", 3), new CreditCount("WAIVED", 1));
        assertThat(snapshot.actions()).extracting(Action::issue)
                .containsExactly("Incomplete attendance", "Incomplete attendance", "Recorded absences", "No class feedback");
    }

    @Test void partnerAssemblyKeepsAggregatesButOmitsIdentityAndPrivateOperationalDetails() {
        var snapshot = OverallReportSnapshotBuilder.build(courses(), scope(Audience.PARTNER), preparedAt, "Reviewer");
        assertThat(snapshot.studentCount()).isEqualTo(2);
        assertThat(snapshot.attendance()).isEqualTo(new AttendanceSummary(8, 3, 1, 2, 2, 67));
        assertThat(snapshot.students()).isNull();
        assertThat(snapshot.actions()).isEmpty();
        assertThat(snapshot.creditDecisions()).isEmpty();
    }

    @Test void emptyAssemblyDoesNotInventStudentsOrPerfectRates() {
        var snapshot = OverallReportSnapshotBuilder.build(List.of(), scope(Audience.INTERNAL), preparedAt, "Reviewer");
        assertThat(snapshot.students()).isEmpty();
        assertThat(snapshot.studentCount()).isZero();
        assertThat(snapshot.attendance()).isEqualTo(new AttendanceSummary(0, 0, 0, 0, 0, null));
        assertThat(snapshot.attendanceTrend()).isEmpty();
        assertThat(snapshot.confirmedEvents()).isEmpty();
        assertThat(snapshot.actions()).isEmpty();
    }

    private Scope scope(Audience audience) {
        return new Scope(week, week.plusWeeks(1), audience, List.of());
    }

    private List<OverallReportCourseEvidence.Facts> courses() {
        var first = new AttendanceSummary(5, 3, 1, 0, 1, 100);
        var second = new AttendanceSummary(3, 0, 0, 2, 1, 0);
        return List.of(
                facts("FIRST", 5, first, List.of(new ClassReportModels.StudentRow(sharedStudent, "Shared Student", "S1", first)),
                        List.of("First note", "Second note"), List.of(new CreditCount("AVAILABLE", 2)), 1, 2),
                facts("SECOND", 2, second, List.of(
                        new ClassReportModels.StudentRow(sharedStudent, "Shared Student", "S1", new AttendanceSummary(1, 0, 0, 1, 0, 0)),
                        new ClassReportModels.StudentRow(otherStudent, "Other Student", "S2", new AttendanceSummary(2, 0, 0, 1, 1, 0))),
                        List.of(), List.of(new CreditCount("AVAILABLE", 1), new CreditCount("WAIVED", 1)), 2, 3));
    }

    private OverallReportCourseEvidence.Facts facts(String code, int sessions, AttendanceSummary totals,
            List<ClassReportModels.StudentRow> students, List<String> notes, List<CreditCount> credits, int awards, int observations) {
        var marks = new ClassReportAttendance.Result(students, List.of(), totals,
                List.of(new AttendancePoint(week, totals)), List.of(new EventCount("DISCUSSION", observations)), List.of());
        return new OverallReportCourseEvidence.Facts(new CourseRow(UUID.randomUUID(), code, "2026", students.size(),
                sessions, totals, notes.size()), marks, notes, credits, awards);
    }
}
