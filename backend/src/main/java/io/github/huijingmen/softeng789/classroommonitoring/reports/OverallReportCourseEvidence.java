package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Accomplishment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AccomplishmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassFeedbackRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.*;

/** Loads one course's historical facts. Never queries personal progress notes. */
@Component
public class OverallReportCourseEvidence {
    private static final ZoneId ZONE = ZoneId.of("Pacific/Auckland");
    private final ClassroomSessionRepository sessions;
    private final ClassFeedbackRepository feedback;
    private final AccomplishmentRepository achievements;
    private final LessonCreditRepository credits;
    private final ClassReportAttendance attendance;
    private final ReportAchievementEligibility eligibility;

    public OverallReportCourseEvidence(ClassroomSessionRepository sessions, ClassFeedbackRepository feedback,
            AccomplishmentRepository achievements, LessonCreditRepository credits,
            ClassReportAttendance attendance, ReportAchievementEligibility eligibility) {
        this.sessions = sessions;
        this.feedback = feedback;
        this.achievements = achievements;
        this.credits = credits;
        this.attendance = attendance;
        this.eligibility = eligibility;
    }

    record Facts(CourseRow course, ClassReportAttendance.Result marks, List<String> notes,
                 List<CreditCount> credits, long achievements) { }

    Facts load(CourseOffering course, Scope scope, Instant asOf) {
        var lessons = sessions.findByCourseOffering_IdAndDateBetweenAndStatusOrderByDateAscStartTimeAsc(
                course.getId(), scope.dateFrom(), scope.dateTo(), ClassroomSession.SessionStatus.COMPLETED).stream()
                .filter(row -> ReportSessionTime.completedBy(row, asOf)).toList();
        var marks = attendance.build(new ClassReportModels.Scope(course.getId(), scope.dateFrom(), scope.dateTo()), lessons, asOf);
        var notes = feedback.findByCourseOffering_IdOrderByCreatedAtDesc(course.getId()).stream()
                .filter(row -> inRange(row.getCreatedAt().atZone(ZONE).toLocalDate(), scope))
                .map(row -> ReportSourceEvidence.label(course) + " · " + row.getCreatedAt() + ": " + row.getComment()).toList();
        var row = new CourseRow(course.getId(), course.getCourse().getCode(), course.getAcademicTerm(),
                marks.students().size(), lessons.size(), marks.attendance(), notes.size());
        return new Facts(row, marks, notes, creditCounts(course.getId(), scope, asOf), achievementCount(course.getId(), scope));
    }

    private List<CreditCount> creditCounts(UUID courseId, Scope scope, Instant asOf) {
        var counts = credits.findBySessionPackage_CourseOffering_IdAndOriginalSession_DateBetween(
                courseId, scope.dateFrom(), scope.dateTo()).stream()
                .filter(row -> ReportSessionTime.completedBy(row.getOriginalSession(), asOf))
                .collect(Collectors.groupingBy(row -> row.getStatus().name(), TreeMap::new, Collectors.counting()));
        return counts.entrySet().stream().map(entry -> new CreditCount(entry.getKey(), entry.getValue())).toList();
    }

    private long achievementCount(UUID courseId, Scope scope) {
        var candidates = achievements.findByCourseOffering_IdOrderByAchievementDateDescCreatedAtDesc(courseId).stream()
                .filter(row -> row.getStatus() == Accomplishment.Status.CONFIRMED && row.isIncludeInReport())
                .filter(row -> inRange(row.getAchievementDate(), scope)).toList();
        return eligibility.select(candidates).included().size();
    }

    private boolean inRange(LocalDate date, Scope scope) {
        return date != null && !date.isBefore(scope.dateFrom()) && !date.isAfter(scope.dateTo());
    }
}
