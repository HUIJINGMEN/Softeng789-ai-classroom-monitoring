package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Snapshot;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.*;
import static org.assertj.core.api.Assertions.assertThat;

class OverallReportContentTest {
    private static final AttendanceSummary TOTALS = new AttendanceSummary(12, 5, 1, 2, 4, 75);

    private Snapshot snapshot(List<CourseRow> courses, AttendanceSummary totals, List<AttendancePoint> weeks) {
        return new Snapshot(Instant.parse("2026-10-15T00:00:00Z"), "Reviewer", true, 4, 4,
                totals, weeks, List.of(), courses, 2, 0,
                List.of(new CreditCount("MAKEUP_SCHEDULED", 1)), List.of());
    }

    private List<CourseRow> courses() {
        return List.of(new CourseRow(UUID.randomUUID(), "TEST 101", "2026", 3, 3,
                        new AttendanceSummary(8, 3, 1, 1, 3, 80), 2),
                new CourseRow(UUID.randomUUID(), "TEST 102", "2026", 2, 1,
                        new AttendanceSummary(4, 2, 0, 1, 1, 67), 0),
                new CourseRow(UUID.randomUUID(), "TEST 103", "2026", 1, 0,
                        new AttendanceSummary(0, 0, 0, 0, 0, null), 0));
    }

    private Section section(Snapshot snapshot, Audience audience, Topic topic) {
        return OverallReportDrafts.sections(snapshot, audience, List.of()).stream()
                .filter(row -> row.topic() == topic).findFirst().orElseThrow();
    }

    @Test void overviewExplainsCourseAndFeedbackCoverageWithoutInventingActivity() {
        var report = snapshot(courses(), TOTALS, List.of());
        assertThat(section(report, Audience.INTERNAL, Topic.OVERVIEW).text())
                .contains("Past completed sessions are recorded for 2 of 3 courses", "teacher feedback is recorded for 1 of 3 courses",
                        "8 of 12 expected marks", "67% completeness", "not a judgement of course quality");
    }

    @Test void attendanceExplainsBothDenominatorsAndWeeklyContext() {
        var weeks = List.of(new AttendancePoint(LocalDate.of(2026, 10, 5), new AttendanceSummary(4, 1, 1, 1, 1, 67)),
                new AttendancePoint(LocalDate.of(2026, 10, 12), new AttendanceSummary(8, 4, 0, 1, 3, 80)));
        var section = section(snapshot(courses(), TOTALS, weeks), Audience.INTERNAL, Topic.ATTENDANCE);
        assertThat(section.text()).contains("6 attended of 8 recorded marks", "8 of 12 expected marks",
                "2026-10-05", "2026-10-12", "do not establish improvement or deterioration");
        assertThat(section.evidence()).anyMatch(row -> row.contains("TEST 102") && row.contains("1 expected mark is not recorded"));
    }

    @Test void absenceCountsAreNotPeopleOrCompletedMakeUpsAndPartnerDropsCreditStatuses() {
        var report = snapshot(courses(), TOTALS, List.of());
        var internal = section(report, Audience.INTERNAL, Topic.ABSENCES);
        assertThat(internal.text()).contains("Recorded absence marks: 2; courses with absences: 2", "not distinct absent students",
                "MAKEUP_SCHEDULED: 1", "A booking does not prove completion", "not a completed action");
        var partner = section(report, Audience.PARTNER, Topic.ABSENCES);
        assertThat(partner.text()).doesNotContain("MAKEUP_SCHEDULED");
        assertThat(partner.evidence()).noneMatch(row -> row.contains("MAKEUP_SCHEDULED"));
    }

    @Test void zeroDataRemainsUnavailableInsteadOfPerfectAttendance() {
        var empty = snapshot(List.of(), new AttendanceSummary(0, 0, 0, 0, 0, null), List.of());
        assertThat(section(empty, Audience.INTERNAL, Topic.ATTENDANCE).text()).contains("Attendance is unavailable",
                "No expected attendance marks", "No weekly attendance records").doesNotContain("100%");
    }

    @Test void largeScopesKeepEditableAbsenceDraftsWithinTheExistingTextLimit() {
        var many = IntStream.range(0, 100).mapToObj(index -> new CourseRow(UUID.randomUUID(), "COURSE " + index,
                "2026 Teaching Year", 1, 1, new AttendanceSummary(1, 0, 0, 1, 0, 0), 0)).toList();
        var report = snapshot(many, new AttendanceSummary(100, 0, 0, 100, 0, 0), List.of());
        var text = section(report, Audience.INTERNAL, Topic.ABSENCES).text();
        assertThat(text).contains("Another 95 courses");
        assertThat(text.length()).isLessThan(6000);
    }

    @Test void courseDetailChangesInvalidateAttendanceReviewEvenWhenTotalsStayTheSame() {
        var first = courses();
        var changed = new java.util.ArrayList<>(first);
        var row = first.getFirst();
        changed.set(0, new CourseRow(row.id(), row.code(), row.term(), row.students(), row.completedSessions(),
                row.attendance(), row.feedbackCount() + 1));
        assertThat(section(snapshot(first, TOTALS, List.of()), Audience.INTERNAL, Topic.ATTENDANCE).fingerprint())
                .isNotEqualTo(section(snapshot(changed, TOTALS, List.of()), Audience.INTERNAL, Topic.ATTENDANCE).fingerprint());
    }

    @Test void changesInMiddleWeeksInvalidateAttendanceReviewWithoutChangingTheEndpoints() {
        var date = LocalDate.of(2026, 9, 7);
        var first = new AttendancePoint(date, new AttendanceSummary(2, 1, 0, 0, 1, 100));
        var last = new AttendancePoint(date.plusWeeks(3), new AttendanceSummary(2, 1, 0, 0, 1, 100));
        var present = new AttendanceSummary(1, 1, 0, 0, 0, 100);
        var absent = new AttendanceSummary(1, 0, 0, 1, 0, 0);
        var before = List.of(first, new AttendancePoint(date.plusWeeks(1), present), new AttendancePoint(date.plusWeeks(2), absent), last);
        var after = List.of(first, new AttendancePoint(date.plusWeeks(1), absent), new AttendancePoint(date.plusWeeks(2), present), last);
        assertThat(section(snapshot(courses(), TOTALS, before), Audience.INTERNAL, Topic.ATTENDANCE).fingerprint())
                .isNotEqualTo(section(snapshot(courses(), TOTALS, after), Audience.INTERNAL, Topic.ATTENDANCE).fingerprint());
    }

    @Test void achievementAndObservationAppendicesInvalidateReviewWithoutChangingAttendance() {
        var base = snapshot(courses(), TOTALS, List.of());
        var awards = new Snapshot(base.preparedAt(), base.preparedBy(), base.allCourses(), base.studentCount(),
                base.completedSessions(), base.attendance(), base.attendanceTrend(), base.confirmedEvents(), base.courses(),
                base.feedbackCount(), 2, base.creditDecisions(), base.actions());
        var events = new Snapshot(base.preparedAt(), base.preparedBy(), base.allCourses(), base.studentCount(),
                base.completedSessions(), base.attendance(), base.attendanceTrend(), List.of(new EventCount("DISCUSSION", 12)),
                base.courses(), base.feedbackCount(), base.achievements(), base.creditDecisions(), base.actions());
        for (var audience : Audience.values()) {
            var original = section(base, audience, Topic.OVERVIEW).fingerprint();
            assertThat(section(awards, audience, Topic.OVERVIEW).fingerprint()).isNotEqualTo(original);
            assertThat(section(events, audience, Topic.OVERVIEW).fingerprint()).isNotEqualTo(original);
        }
    }

    @Test void legacyPersonalDetailsAreDiscardedForBothOverallAudiences() throws Exception {
        var json = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules();
        var base = snapshot(courses(), TOTALS, List.of());
        var raw = (com.fasterxml.jackson.databind.node.ObjectNode) json.valueToTree(base);
        raw.putArray("studentDetails").addObject().put("name", "Private Name").put("number", "PRIVATE-ID");
        var legacy = json.treeToValue(raw, Snapshot.class);
        for (var audience : Audience.values()) {
            var document = new OverallReportModels.Document(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 10, 1),
                    audience, List.of(), List.of(), legacy);
            var safe = OverallReportPrivacy.project(document);
            assertThat(json.writeValueAsString(safe)).doesNotContain("studentDetails", "Private Name", "PRIVATE-ID");
            assertThat(safe.snapshot().studentCount()).isEqualTo(base.studentCount());
        }
        assertThat(raw.get("studentDetails").toString()).contains("Private Name");
    }

    @Test void internalRosterChangesRequireReviewAndPartnerProjectionStripsStoredNames() throws Exception {
        var base = snapshot(courses(), TOTALS, List.of());
        UUID studentId = UUID.randomUUID();
        var studentCourses = List.of(new RosterCourse(base.courses().getFirst().id(), "TEST 101"));
        var original = withRoster(base, new RosterStudent(studentId, "Student Name", "STUDENT-001", TOTALS, studentCourses));
        var fingerprint = section(original, Audience.INTERNAL, Topic.OVERVIEW).fingerprint();
        for (var student : List.of(
                new RosterStudent(studentId, "Changed Name", "STUDENT-001", TOTALS, studentCourses),
                new RosterStudent(studentId, "Student Name", "STUDENT-002", TOTALS, studentCourses),
                new RosterStudent(studentId, "Student Name", "STUDENT-001", new AttendanceSummary(12, 4, 2, 2, 4, 75), studentCourses),
                new RosterStudent(studentId, "Student Name", "STUDENT-001", TOTALS, List.of()))) {
            var changed = withRoster(base, student);
            assertThat(section(changed, Audience.INTERNAL, Topic.OVERVIEW).fingerprint()).isNotEqualTo(fingerprint);
            assertThat(section(changed, Audience.PARTNER, Topic.OVERVIEW).fingerprint())
                    .isEqualTo(section(original, Audience.PARTNER, Topic.OVERVIEW).fingerprint());
        }
        var document = new OverallReportModels.Document(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 10, 1),
                Audience.PARTNER, List.of(), List.of(), original);
        var projected = OverallReportPrivacy.project(document);
        assertThat(projected.snapshot().students()).isNull();
        var json = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules();
        assertThat(json.writeValueAsString(projected)).doesNotContain("Student Name", "STUDENT-001", studentId.toString(), "\"students\":[");
    }

    private Snapshot withRoster(Snapshot base, RosterStudent student) {
        return new Snapshot(base.preparedAt(), base.preparedBy(), base.allCourses(), base.studentCount(),
                base.completedSessions(), base.attendance(), base.attendanceTrend(), base.confirmedEvents(), base.courses(),
                base.feedbackCount(), base.achievements(), base.creditDecisions(), base.actions(), List.of(student));
    }
}
