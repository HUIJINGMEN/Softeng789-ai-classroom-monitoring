package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.TeacherScopeSupport;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Document;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Scope;
import io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Snapshot;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.*;

@Component
public class OverallReportEvidence {
    private final CourseOfferingRepository courses;
    private final ClassroomSessionRepository sessions;
    private final ClassFeedbackRepository feedback;
    private final AccomplishmentRepository achievements;
    private final LessonCreditRepository credits;
    private final ClassReportAttendance attendance;
    private final TeacherScopeSupport access;
    public OverallReportEvidence(CourseOfferingRepository courses, ClassroomSessionRepository sessions,
            ClassFeedbackRepository feedback, AccomplishmentRepository achievements, LessonCreditRepository credits,
            ClassReportAttendance attendance, TeacherScopeSupport access) {
        this.courses = courses; this.sessions = sessions; this.feedback = feedback; this.achievements = achievements;
        this.credits = credits; this.attendance = attendance; this.access = access;
    }
    void authorize(UUID caller) {
        if (!access.isAdmin(access.requireCaller(caller))) throw new ResponseStatusException(FORBIDDEN,
                "Institution reports are prepared and exported by administrators.");
    }
    Scope normalize(Scope scope) {
        if (scope.dateTo().isBefore(scope.dateFrom()) || ChronoUnit.DAYS.between(scope.dateFrom(), scope.dateTo()) > 366)
            throw new ResponseStatusException(BAD_REQUEST, "Choose a valid reporting period of up to one year.");
        return new Scope(scope.dateFrom(), scope.dateTo(), scope.audience(), scope.courseOfferingIds().stream().distinct().sorted().toList());
    }
    Document build(Scope scope, UUID caller) {
        authorize(caller);
        var selected = scope.courseOfferingIds().isEmpty() ? courses.findAllByOrderByOfferingCodeAsc()
                : courses.findAllById(scope.courseOfferingIds());
        if (!scope.courseOfferingIds().isEmpty() && selected.size() != scope.courseOfferingIds().size())
            throw new ResponseStatusException(NOT_FOUND, "A selected course no longer exists.");
        if (selected.size() > 100) throw new ResponseStatusException(BAD_REQUEST, "Select up to 100 courses for one report.");
        selected = selected.stream().sorted(Comparator.comparing(CourseOffering::getOfferingCode)).toList();
        Instant asOf = Instant.now();
        List<ClassReportAttendance.Result> marks = new ArrayList<>();
        List<CourseRow> courseRows = new ArrayList<>();
        List<Action> actions = new ArrayList<>();
        List<String> notes = new ArrayList<>();
        Map<String, Long> creditCounts = new TreeMap<>();
        long awardCount = 0;
        for (var course : selected) {
            var lessons = sessions.findByCourseOffering_IdAndDateBetweenAndStatusOrderByDateAscStartTimeAsc(course.getId(),
                    scope.dateFrom(), scope.dateTo(), ClassroomSession.SessionStatus.COMPLETED).stream()
                    .filter(row -> ReportSessionTime.completedBy(row, asOf)).toList();
            var rows = attendance.build(new ClassReportModels.Scope(course.getId(), scope.dateFrom(), scope.dateTo()), lessons, asOf);
            marks.add(rows);
            var classNotes = feedback.findByCourseOffering_IdOrderByCreatedAtDesc(course.getId()).stream()
                    .filter(row -> inRange(row.getCreatedAt().atZone(ZoneId.of("Pacific/Auckland")).toLocalDate(), scope)).toList();
            // Only class-wide teacher notes. Personal notes, reasons and health details are never queried.
            classNotes.forEach(note -> notes.add(course.getCourse().getCode() + " · " + course.getAcademicTerm()
                    + " · " + note.getCreatedAt() + ": " + note.getComment()));
            courseRows.add(new CourseRow(course.getId(), course.getCourse().getCode(), course.getAcademicTerm(),
                    rows.students().size(), lessons.size(), rows.attendance(), classNotes.size()));
            if (scope.audience() == Audience.INTERNAL) addActions(course, rows, classNotes.size(), actions);
            credits.findBySessionPackage_CourseOffering_IdAndOriginalSession_DateBetween(course.getId(), scope.dateFrom(), scope.dateTo())
                    .stream().filter(row -> ReportSessionTime.completedBy(row.getOriginalSession(), asOf))
                    .forEach(row -> creditCounts.merge(row.getStatus().name(), 1L, Long::sum));
            awardCount += achievements.findByCourseOffering_IdOrderByAchievementDateDescCreatedAtDesc(course.getId()).stream()
                    .filter(row -> row.getStatus() == Accomplishment.Status.CONFIRMED && row.isIncludeInReport()
                            && inRange(row.getAchievementDate(), scope)).count();
        }
        int uniqueStudents = (int) marks.stream().flatMap(row -> row.students().stream()).map(ClassReportModels.StudentRow::id).distinct().count();
        var totals = OverallReportTotals.sum(marks.stream().map(ClassReportAttendance.Result::attendance).toList());
        var snapshot = new Snapshot(asOf, access.requireCaller(caller).getName(), scope.courseOfferingIds().isEmpty(), uniqueStudents,
                courseRows.stream().mapToInt(CourseRow::completedSessions).sum(), totals, OverallReportTotals.trend(marks),
                OverallReportTotals.events(marks), courseRows, notes.size(), awardCount,
                scope.audience() == Audience.INTERNAL ? creditCounts.entrySet().stream()
                    .map(entry -> new CreditCount(entry.getKey(), entry.getValue())).toList() : List.of(), List.copyOf(actions));
        return new Document(scope.dateFrom(), scope.dateTo(), scope.audience(), scope.courseOfferingIds(),
                OverallReportDrafts.sections(snapshot, scope.audience(), notes), snapshot);
    }
    private void addActions(CourseOffering course, ClassReportAttendance.Result marks, int feedbackCount, List<Action> actions) {
        String label = course.getCourse().getCode() + " · " + course.getAcademicTerm();
        if (marks.attendance().unrecorded() > 0) actions.add(new Action(course.getId(), label, "Incomplete attendance",
                marks.attendance().unrecorded(), "Check and record missing attendance marks."));
        if (marks.attendance().absent() > 0) actions.add(new Action(course.getId(), label, "Recorded absences",
                marks.attendance().absent(), "Review absence records and linked arrangements privately; a make-up is not automatic."));
        if (feedbackCount == 0 && !marks.sessions().isEmpty()) actions.add(new Action(course.getId(), label,
                "No class feedback", 1, "Add class-wide teacher feedback before assessing teaching outcomes."));
    }
    private boolean inRange(LocalDate date, Scope scope) {
        return date != null && !date.isBefore(scope.dateFrom()) && !date.isAfter(scope.dateTo());
    }
}
