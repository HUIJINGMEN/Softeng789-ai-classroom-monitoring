package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.TeacherScopeSupport;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

@Service
@Transactional(readOnly = true)
public class ClassReportEvidence {
    private final CourseOfferingRepository courses;
    private final ClassroomSessionRepository sessions;
    private final ClassFeedbackRepository feedback;
    private final LessonCreditRepository credits;
    private final TeacherScopeSupport access;
    private final ClassReportAttendance attendance;
    private final ClassReportPayments payments;
    public ClassReportEvidence(CourseOfferingRepository courses, ClassroomSessionRepository sessions, ClassFeedbackRepository feedback,
            LessonCreditRepository credits,
            TeacherScopeSupport access, ClassReportAttendance attendance, ClassReportPayments payments) {
        this.courses = courses; this.sessions = sessions; this.feedback = feedback;
        this.credits = credits; this.access = access; this.attendance = attendance; this.payments = payments;
    }
    CourseOffering authorize(UUID courseId, UUID callerId) {
        var caller = access.requireCaller(callerId);
        var course = courses.findById(courseId).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
        access.assertCanAccessOffering(course, caller);
        return course;
    }
    ClassReportModels.Document build(ClassReportModels.Scope scope, UUID caller) {
        if (scope.dateTo().isBefore(scope.dateFrom())) throw new ResponseStatusException(BAD_REQUEST, "Invalid reporting period.");
        var course = authorize(scope.courseOfferingId(), caller);
        Instant asOf = Instant.now();
        var lessons = sessions.findByCourseOffering_IdAndDateBetweenAndStatusOrderByDateAscStartTimeAsc(course.getId(),
                scope.dateFrom(), scope.dateTo(), ClassroomSession.SessionStatus.COMPLETED).stream()
                .filter(row -> ReportSessionTime.completedBy(row, asOf)).toList();
        var marks = attendance.build(scope, lessons, asOf);
        var notes = feedback.findByCourseOffering_IdOrderByCreatedAtDesc(course.getId()).stream()
                .filter(row -> inRange(row.getCreatedAt().atZone(ZoneId.of("Pacific/Auckland")).toLocalDate(), scope)).toList();
        var financial = payments.build(course.getId(), marks.students().stream().map(ClassReportModels.StudentRow::id).toList());
        var snapshot = new ClassReportModels.Snapshot(new ClassReportModels.ClassInfo(course.getId(), course.getCourse().getCode(),
                course.getCourse().getName(), course.getAcademicTerm(), course.getTeachers().stream().map(Teacher::getName).sorted().toList()),
                asOf, lessons.size(), marks.attendance(), marks.trend(), marks.events(), marks.students(), marks.sessions(), notes.size(), financial);
        List<Section> sections = new ArrayList<>();
        var totals = marks.attendance();
        sections.add(ReportEvidence.section(Topic.ATTENDANCE, "Class attendance", List.of(
                lessons.size() + " past completed class sessions; " + marks.students().size() + " students in this reporting scope.",
                "Expected student attendance marks: " + totals.completed() + "; present=" + totals.present() + "; late=" + totals.late()
                        + "; absent=" + totals.absent() + "; not recorded=" + totals.unrecorded() + "; recorded-mark attendance rate=" + (totals.rate() == null ? "Unavailable" : totals.rate() + "%"),
                "Enrolment dates are respected. Future and cancelled lessons are excluded; unrecorded marks are not absences.")));
        List<String> financialFacts = new ArrayList<>(financial.totals().stream().map(row -> row.currency() + "; invoices=" + row.invoices() + "; charges=" + row.charges()
                    + "; credits=" + row.credits() + "; confirmed net receipts=" + row.received() + "; outstanding=" + row.balance()
                    + "; awaiting verification=" + row.awaitingVerification()).toList());
        financialFacts.add("Excluded mixed or unlinked invoices=" + financial.excludedInvoices()
                + "; students without class-only invoice=" + financial.studentsWithoutInvoice()
                + ". Snapshot balances at preparation, not period-only transactions or whole-account balances. Missing invoices do not mean no fees are due.");
        sections.add(ReportEvidence.section(Topic.PAYMENTS, "Class payments", financialFacts));
        sections.add(ReportEvidence.section(Topic.ABSENCES, "Absences & make-ups", absenceFacts(scope, marks, asOf)));
        List<String> learning = notes.stream().map(row -> row.getCreatedAt() + ": " + row.getComment()).toList();
        if (learning.isEmpty()) learning = List.of("No class-wide teacher feedback recorded in this period. Do not invent an assessment.");
        sections.add(ReportEvidence.section(Topic.LEARNING, "Class teacher feedback", learning));
        return new ClassReportModels.Document(scope.dateFrom(), scope.dateTo(), sections, snapshot);
    }
    private List<String> absenceFacts(ClassReportModels.Scope scope, ClassReportAttendance.Result marks, Instant asOf) {
        List<String> facts = new ArrayList<>(marks.absenceFacts());
        if (facts.isEmpty()) facts.add("No recorded absence marks in completed lessons during this period.");
        var decisions = credits.findBySessionPackage_CourseOffering_IdAndOriginalSession_DateBetween(
                scope.courseOfferingId(), scope.dateFrom(), scope.dateTo()).stream()
                .filter(row -> ReportSessionTime.completedBy(row.getOriginalSession(), asOf))
                .collect(Collectors.groupingBy(row -> row.getStatus().name(), TreeMap::new, Collectors.counting()));
        decisions.forEach((status, count) -> facts.add("Linked lesson-credit decision status " + status + ": " + count));
        facts.add("Credit decision counts are not make-up attendance. A booked session is not proof of completion. No personal reasons or health details are included.");
        return facts;
    }
    private boolean inRange(LocalDate date, ClassReportModels.Scope scope) {
        return !date.isBefore(scope.dateFrom()) && !date.isAfter(scope.dateTo());
    }
}
