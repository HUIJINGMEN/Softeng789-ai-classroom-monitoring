package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.*;

/** Pure assembly: raw-count weighting, roster deduplication and audience-specific projections. */
final class OverallReportSnapshotBuilder {
    private OverallReportSnapshotBuilder() { }

    static Snapshot build(List<OverallReportCourseEvidence.Facts> courses, Scope scope, Instant asOf, String preparedBy) {
        var marks = courses.stream().map(OverallReportCourseEvidence.Facts::marks).toList();
        var courseRows = courses.stream().map(OverallReportCourseEvidence.Facts::course).toList();
        int uniqueStudents = (int) marks.stream().flatMap(row -> row.students().stream())
                .map(ClassReportModels.StudentRow::id).distinct().count();
        boolean internal = scope.audience() == Audience.INTERNAL;
        return new Snapshot(asOf, preparedBy, scope.courseOfferingIds().isEmpty(), uniqueStudents,
                courseRows.stream().mapToInt(CourseRow::completedSessions).sum(),
                OverallReportTotals.sum(marks.stream().map(ClassReportAttendance.Result::attendance).toList()),
                OverallReportTotals.trend(marks), OverallReportTotals.events(marks), courseRows,
                courses.stream().mapToInt(row -> row.notes().size()).sum(),
                courses.stream().mapToLong(OverallReportCourseEvidence.Facts::achievements).sum(),
                internal ? creditCounts(courses) : List.of(),
                internal ? actions(courseRows) : List.of(), internal ? roster(courses) : null);
    }

    private static List<RosterStudent> roster(List<OverallReportCourseEvidence.Facts> courses) {
        var roster = new OverallReportRoster();
        courses.forEach(row -> roster.add(row.course().id(), label(row.course()), row.marks().students()));
        return roster.snapshot();
    }

    private static List<CreditCount> creditCounts(List<OverallReportCourseEvidence.Facts> courses) {
        var counts = new TreeMap<String, Long>();
        courses.forEach(course -> course.credits().forEach(row -> counts.merge(row.status(), row.count(), Long::sum)));
        return counts.entrySet().stream().map(entry -> new CreditCount(entry.getKey(), entry.getValue())).toList();
    }

    private static List<Action> actions(List<CourseRow> courses) {
        List<Action> actions = new ArrayList<>();
        for (var course : courses) {
            if (course.attendance().unrecorded() > 0) actions.add(new Action(course.id(), label(course),
                    "Incomplete attendance", course.attendance().unrecorded(), "Check and record missing attendance marks."));
            if (course.attendance().absent() > 0) actions.add(new Action(course.id(), label(course),
                    "Recorded absences", course.attendance().absent(),
                    "Review absence records and linked arrangements privately; a make-up is not automatic."));
            if (course.feedbackCount() == 0 && course.completedSessions() > 0) actions.add(new Action(course.id(), label(course),
                    "No class feedback", 1, "Add class-wide teacher feedback before assessing teaching outcomes."));
        }
        return List.copyOf(actions);
    }

    private static String label(CourseRow course) {
        return course.code() + " · " + course.term();
    }
}
