package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.*;

/** Deduplicated internal roster from the same historical attendance scope. No personal progress notes. */
final class OverallReportRoster {
    private final Map<UUID, Member> members = new LinkedHashMap<>();
    void add(UUID courseId, String label, List<ClassReportModels.StudentRow> rows) {
        for (var row : rows) {
            var member = members.computeIfAbsent(row.id(), ignored -> new Member(row));
            member.courses.add(new RosterCourse(courseId, label));
            member.attendance.add(row.attendance());
        }
    }
    List<RosterStudent> snapshot() {
        return members.values().stream().map(member -> new RosterStudent(member.row.id(), member.row.name(), member.row.number(),
                OverallReportTotals.sum(member.attendance), List.copyOf(member.courses)))
                .sorted(Comparator.comparing(RosterStudent::name).thenComparing(RosterStudent::number).thenComparing(RosterStudent::id)).toList();
    }
    private static final class Member {
        private final ClassReportModels.StudentRow row;
        private final List<RosterCourse> courses = new ArrayList<>();
        private final List<ReportModels.AttendanceSummary> attendance = new ArrayList<>();
        private Member(ClassReportModels.StudentRow row) { this.row = row; }
    }
}
