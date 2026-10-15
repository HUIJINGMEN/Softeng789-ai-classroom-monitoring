package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

/** Bulk-loaded historical roster. Missing marks apply only to lessons during each enrolment. */
@Component
public class ClassReportAttendance {
    private static final ZoneId ZONE = ZoneId.of("Pacific/Auckland");
    private final CourseEnrollmentRepository enrolments;
    private final AttendanceRecordRepository attendance;
    private final BehaviourEventRepository events;
    public ClassReportAttendance(CourseEnrollmentRepository enrolments, AttendanceRecordRepository attendance,
            BehaviourEventRepository events) {
        this.enrolments = enrolments; this.attendance = attendance; this.events = events;
    }
    record Result(List<ClassReportModels.StudentRow> students, List<ClassReportModels.SessionRow> sessions,
                  AttendanceSummary attendance, List<AttendancePoint> trend, List<EventCount> events,
                  List<String> absenceFacts) { }
    private record Member(Student student, List<ClassroomSession> lessons, List<AttendanceRecord> marks) { }

    Result build(ClassReportModels.Scope scope, List<ClassroomSession> lessons, Instant asOf) {
        var entries = enrolments.findByCourseOffering_IdInAndStatusInOrderByStudent_LastNameAscStudent_FirstNameAsc(
                List.of(scope.courseOfferingId()), List.of(CourseEnrollment.EnrollmentStatus.values()));
        var records = lessons.isEmpty() ? List.<AttendanceRecord>of()
                : attendance.findBySession_IdIn(lessons.stream().map(ClassroomSession::getId).toList());
        Map<UUID, Student> roster = new LinkedHashMap<>();
        entries.stream().filter(row -> applicableInPeriod(row, scope, asOf))
                .forEach(row -> roster.put(row.getStudent().getId(), row.getStudent()));
        records.forEach(row -> roster.putIfAbsent(row.getStudent().getId(), row.getStudent()));
        var enrolmentByStudent = entries.stream().collect(Collectors.toMap(row -> row.getStudent().getId(), row -> row));
        var recordsByStudent = records.stream().collect(Collectors.groupingBy(row -> row.getStudent().getId()));
        List<Member> members = roster.values().stream().map(student -> {
            var marks = recordsByStudent.getOrDefault(student.getId(), List.of());
            var markedIds = marks.stream().map(row -> row.getSession().getId()).collect(Collectors.toSet());
            var applicable = lessons.stream().filter(lesson -> markedIds.contains(lesson.getId())
                    || applicableOn(enrolmentByStudent.get(student.getId()), lesson.getDate())).toList();
            return new Member(student, applicable, marks);
        }).toList();
        var students = members.stream().map(member -> new ClassReportModels.StudentRow(member.student().getId(),
                member.student().getFullName(), member.student().getStudentNumber(), summary(member.lessons(), member.marks())))
                .sorted(Comparator.comparing(ClassReportModels.StudentRow::name).thenComparing(ClassReportModels.StudentRow::number)).toList();
        var sessions = lessons.stream().map(lesson -> new ClassReportModels.SessionRow(lesson.getId(), lesson.getDate(),
                lesson.getStartTime(), lesson.getRoom(), totalFor(List.of(lesson), members))).toList();
        var weeks = lessons.stream().collect(Collectors.groupingBy(lesson -> lesson.getDate()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)), TreeMap::new, Collectors.toList()));
        var trend = weeks.entrySet().stream().map(entry -> new AttendancePoint(entry.getKey(), totalFor(entry.getValue(), members))).toList();
        var reviewedEvents = lessons.isEmpty() ? List.<BehaviourEvent>of()
                : events.findBySession_IdIn(lessons.stream().map(ClassroomSession::getId).toList()).stream()
                    .filter(row -> row.getReviewStatus() == BehaviourEvent.ReviewStatus.CONFIRMED
                            || row.getReviewStatus() == BehaviourEvent.ReviewStatus.CORRECTED).toList();
        var counts = reviewedEvents.stream().collect(Collectors.groupingBy(BehaviourEvent::getEventType, TreeMap::new, Collectors.counting()));
        var absenceFacts = records.stream().filter(row -> row.getStatus() == AttendanceRecord.AttendanceStatus.ABSENT)
                .collect(Collectors.groupingBy(row -> row.getSession().getDate(), TreeMap::new, Collectors.counting()))
                .entrySet().stream().map(entry -> entry.getKey() + ": " + entry.getValue() + " recorded absence mark(s).").toList();
        return new Result(students, sessions, totalFor(lessons, members), trend,
                counts.entrySet().stream().map(entry -> new EventCount(entry.getKey(), entry.getValue())).toList(), absenceFacts);
    }
    private boolean applicableInPeriod(CourseEnrollment row, ClassReportModels.Scope scope, Instant asOf) {
        LocalDate end = scope.dateTo().isBefore(asOf.atZone(ZONE).toLocalDate()) ? scope.dateTo() : asOf.atZone(ZONE).toLocalDate();
        return row.getStatus() != CourseEnrollment.EnrollmentStatus.PENDING
                && !row.getEnrolledAt().atZone(ZONE).toLocalDate().isAfter(end)
                && (row.getWithdrawnAt() == null || !row.getWithdrawnAt().atZone(ZONE).toLocalDate().isBefore(scope.dateFrom()));
    }
    private boolean applicableOn(CourseEnrollment row, LocalDate date) {
        return row != null && row.getStatus() != CourseEnrollment.EnrollmentStatus.PENDING
                && !date.isBefore(row.getEnrolledAt().atZone(ZONE).toLocalDate())
                && (row.getWithdrawnAt() == null || !date.isAfter(row.getWithdrawnAt().atZone(ZONE).toLocalDate()));
    }
    private AttendanceSummary totalFor(List<ClassroomSession> lessons, List<Member> members) {
        var ids = lessons.stream().map(ClassroomSession::getId).collect(Collectors.toSet());
        var summaries = members.stream().map(member -> summary(member.lessons().stream()
                .filter(lesson -> ids.contains(lesson.getId())).toList(), member.marks())).toList();
        return totals(summaries.stream().mapToLong(AttendanceSummary::completed).sum(),
                summaries.stream().mapToLong(AttendanceSummary::present).sum(), summaries.stream().mapToLong(AttendanceSummary::late).sum(),
                summaries.stream().mapToLong(AttendanceSummary::absent).sum());
    }
    private AttendanceSummary summary(List<ClassroomSession> lessons, List<AttendanceRecord> marks) {
        var ids = lessons.stream().map(ClassroomSession::getId).collect(Collectors.toSet());
        var counts = marks.stream().filter(row -> ids.contains(row.getSession().getId()))
                .collect(Collectors.groupingBy(AttendanceRecord::getStatus, Collectors.counting()));
        return totals(ids.size(), counts.getOrDefault(AttendanceRecord.AttendanceStatus.PRESENT, 0L),
                counts.getOrDefault(AttendanceRecord.AttendanceStatus.LATE, 0L), counts.getOrDefault(AttendanceRecord.AttendanceStatus.ABSENT, 0L));
    }
    private AttendanceSummary totals(long expected, long present, long late, long absent) {
        long recorded = present + late + absent;
        return new AttendanceSummary(expected, present, late, absent, expected - recorded,
                recorded == 0 ? null : (int) Math.round(100.0 * (present + late) / recorded));
    }
}
