package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.*;
import java.util.stream.Collectors;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

/** Aggregate raw numerators and denominators, never average rounded class percentages. */
final class OverallReportTotals {
    private OverallReportTotals() { }
    static AttendanceSummary sum(List<AttendanceSummary> rows) {
        long expected = rows.stream().mapToLong(AttendanceSummary::completed).sum();
        long present = rows.stream().mapToLong(AttendanceSummary::present).sum();
        long late = rows.stream().mapToLong(AttendanceSummary::late).sum();
        long absent = rows.stream().mapToLong(AttendanceSummary::absent).sum();
        long recorded = present + late + absent;
        return new AttendanceSummary(expected, present, late, absent, expected - recorded,
                recorded == 0 ? null : (int) Math.round(100.0 * (present + late) / recorded));
    }
    static List<AttendancePoint> trend(List<ClassReportAttendance.Result> rows) {
        return rows.stream().flatMap(row -> row.trend().stream()).collect(Collectors.groupingBy(
                AttendancePoint::weekOf, TreeMap::new, Collectors.mapping(AttendancePoint::attendance, Collectors.toList())))
                .entrySet().stream().map(entry -> new AttendancePoint(entry.getKey(), sum(entry.getValue()))).toList();
    }
    static List<EventCount> events(List<ClassReportAttendance.Result> rows) {
        return rows.stream().flatMap(row -> row.events().stream()).collect(Collectors.groupingBy(
                EventCount::type, TreeMap::new, Collectors.summingLong(EventCount::count)))
                .entrySet().stream().map(entry -> new EventCount(entry.getKey(), entry.getValue())).toList();
    }
}
