package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.TeacherScopeSupport;
import io.github.huijingmen.softeng789.classroommonitoring.support.repository.StudentSupportRequestRepository;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestType;
import java.time.LocalDate;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

@Service
@Transactional(readOnly = true)
public class StudentReportEvidence {
    private final TeacherScopeSupport access;
    private final StudentRepository students;
    private final CourseOfferingRepository courses;
    private final CourseEnrollmentRepository enrolments;
    private final AttendanceRecordRepository attendance;
    private final ProgressReportRepository feedback;
    private final AccomplishmentRepository achievements;
    private final ReportAchievementEligibility eligibility;
    private final LessonCreditRepository credits;
    private final PaymentReportEvidence payments;
    private final StudentSupportRequestRepository leave;
    private final StudentReportSnapshotBuilder snapshots;
    public StudentReportEvidence(TeacherScopeSupport access, StudentRepository students,
            CourseOfferingRepository courses, CourseEnrollmentRepository enrolments,
            AttendanceRecordRepository attendance, ProgressReportRepository feedback, AccomplishmentRepository achievements,
            ReportAchievementEligibility eligibility, LessonCreditRepository credits, PaymentReportEvidence payments,
            StudentSupportRequestRepository leave, StudentReportSnapshotBuilder snapshots) {
        this.access = access; this.students = students; this.courses = courses; this.enrolments = enrolments;
        this.attendance = attendance; this.feedback = feedback;
        this.achievements = achievements; this.eligibility = eligibility; this.credits = credits; this.payments = payments;
        this.leave = leave;
        this.snapshots = snapshots;
    }
    public void authorize(UUID studentId, List<UUID> courseIds, UUID callerId) {
        if (!students.existsById(studentId)) throw new ResponseStatusException(NOT_FOUND, "Student not found.");
        Teacher caller = access.requireCaller(callerId);
        for (UUID id : courseIds) {
            var course = courses.findById(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
            access.assertCanAccessOffering(course, caller);
            if (enrolments.findByStudent_IdAndCourseOffering_Id(studentId, id).isEmpty()) {
                throw new ResponseStatusException(BAD_REQUEST, "The student has no enrolment in a selected class.");
            }
        }
    }
    public Document build(Scope request, UUID callerId) {
        Instant asOf = Instant.now();
        if (request.dateTo().isBefore(request.dateFrom())) throw new ResponseStatusException(BAD_REQUEST, "Invalid reporting period.");
        var ids = request.courseOfferingIds().stream().distinct().sorted().toList();
        Scope scope = new Scope(request.studentId(), request.dateFrom(), request.dateTo(), ids);
        authorize(scope.studentId(), ids, callerId);
        var labels = ids.stream().map(id -> courses.findById(id).orElseThrow())
                .map(course -> course.getCourse().getCode() + " · " + course.getAcademicTerm()).toList();
        var records = attendance.findByStudent_IdOrderBySession_DateDescSession_StartTimeDesc(scope.studentId()).stream()
                .filter(row -> ids.contains(row.getSession().getCourseOffering().getId()))
                .filter(row -> inRange(row.getSession().getDate(), scope))
                .filter(row -> ReportSessionTime.completedBy(row.getSession(), asOf)).toList();
        List<Section> sections = new ArrayList<>();
        var notes = feedback.findByStudent_IdOrderByCreatedAtDesc(scope.studentId()).stream()
                .filter(row -> scope.courseOfferingIds().contains(row.getCourseOffering().getId()))
                .filter(row -> inRange(row.getCreatedAt().atZone(ZoneId.of("Pacific/Auckland")).toLocalDate(), scope)).toList();
        var payment = payments.buildDetailed(scope);
        var awards = achievements(scope);
        var snapshot = snapshots.build(scope, records, notes, awards, payment.snapshot(), asOf);
        sections.add(attendance(snapshot.attendance()));
        sections.add(payment.section());
        sections.add(absences(scope, records));
        sections.add(learning(notes));
        var awardFacts = achievementFacts(awards.included());
        if (!awardFacts.isEmpty()) sections.add(ReportEvidence.section(Topic.ACHIEVEMENTS, "Achievements", awardFacts));
        return new Document(scope.dateFrom(), scope.dateTo(), ids, labels, ReportSnapshotReview.student(sections, snapshot), snapshot);
    }
    private Section attendance(AttendanceSummary totals) {
        String rate = totals.rate() == null ? "Unavailable (no recorded marks)" : totals.rate() + "%";
        return ReportEvidence.section(Topic.ATTENDANCE, "Attendance", List.of(
                "Past scheduled lessons applicable to this enrolment: " + totals.completed(),
                "Lessons attended by this student (present + late): " + (totals.present() + totals.late()),
                "Present: " + totals.present() + "; late: " + totals.late() + "; absent: " + totals.absent() + "; not recorded: " + totals.unrecorded(),
                "Attendance rate among recorded marks ((present + late) / (present + late + absent)): " + rate,
                "Future/scheduled and cancelled sessions are excluded. Unrecorded marks are not absences."));
    }
    private Section absences(Scope scope, List<AttendanceRecord> records) {
        List<String> facts = new ArrayList<>();
        records.stream().filter(row -> row.getStatus() == AttendanceRecord.AttendanceStatus.ABSENT)
                .forEach(row -> facts.add(row.getSession().getDate() + " " + row.getSession().getCourseOffering().getCourse().getCode()
                        + ": absent; recorded reason=" + ReportEvidence.safe(row.getAbsenceReason() == null ? null : row.getAbsenceReason().name())
                        + "; note=" + ReportEvidence.safe(row.getAbsenceNote())));
        leave.findByStudent_IdOrderBySubmittedAtDesc(scope.studentId()).stream()
                .filter(item -> item.getType() == StudentRequestType.LEAVE && item.getSession() != null)
                .filter(item -> scope.courseOfferingIds().contains(item.getSession().getCourseOffering().getId()))
                .filter(item -> inRange(item.getSession().getDate(), scope))
                .forEach(item -> facts.add("Leave for " + item.getSession().getDate() + "; request status=" + item.getStatus()
                        + "; recorded reason=" + item.getLeaveReason() + "; lesson treatment=" + item.getLeaveLessonTreatment()
                        + "; review note=" + ReportEvidence.safe(item.getReviewNote())));
        for (UUID id : scope.courseOfferingIds()) {
            credits.findBySessionPackage_Student_IdAndSessionPackage_CourseOffering_Id(scope.studentId(), id).stream()
                    .filter(credit -> credit.getOriginalSession() != null && inRange(credit.getOriginalSession().getDate(), scope))
                    .forEach(credit -> facts.add("Original lesson " + credit.getOriginalSession().getDate()
                            + "; credit outcome=" + credit.getStatus() + "; recorded decision=" + ReportEvidence.safe(credit.getDecisionNote())
                            + "; linked lesson=" + (credit.getCurrentSession() == null ? "None" : credit.getCurrentSession().getDate())
                            + "; linked lesson attendance=" + (credit.getCurrentSession() == null ? "Not applicable"
                                : attendance.findBySession_IdAndStudent_Id(credit.getCurrentSession().getId(), scope.studentId())
                                    .map(row -> row.getStatus().name()).orElse("Not recorded"))
                            + ". A booked or completed session alone does not prove make-up attendance."));
        }
        if (facts.isEmpty()) facts.add("No recorded absences or linked lesson-credit decisions in this period.");
        facts.add("Only recorded reasons are evidence. Do not infer illness or reasons. Missing attendance is not absence.");
        return ReportEvidence.section(Topic.ABSENCES, "Absences & make-ups", facts);
    }
    private Section learning(List<ProgressReport> notes) {
        List<String> facts = notes.stream()
                .map(row -> row.getCreatedAt() + " " + row.getCourseOffering().getCourse().getCode() + ": " + row.getComment()).toList();
        if (facts.isEmpty()) facts = List.of("No teacher feedback recorded for these courses and dates. Do not invent a learning evaluation.");
        var section = ReportEvidence.section(Topic.LEARNING, "Teacher feedback summary", facts);
        return notes.isEmpty() ? new Section(section.topic(), section.title(), section.evidence(), section.fingerprint(),
                "No teacher feedback recorded for the selected courses and dates.", "RECORDS", false, false, null, null) : section;
    }
    private ReportAchievementEligibility.Selection achievements(Scope scope) {
        var candidates = achievements.findByStudent_IdAndStatusOrderByAchievementDateDescCreatedAtDesc(scope.studentId(), Accomplishment.Status.CONFIRMED)
                .stream().filter(Accomplishment::isIncludeInReport)
                .filter(row -> scope.courseOfferingIds().contains(row.getCourseOffering().getId()) && inRange(row.getAchievementDate(), scope)).toList();
        return eligibility.select(candidates);
    }
    private List<String> achievementFacts(List<Accomplishment> awards) {
        return awards.stream()
                .map(row -> row.getAchievementDate() + " " + row.getCourseOffering().getCourse().getCode() + ": " + row.getTitle()
                        + "; category=" + row.getCategory() + "; points=" + row.getPoints()
                        + "; details=" + ReportEvidence.safe(row.getDescription()) + "; student note=" + ReportEvidence.safe(row.getStudentNote())).toList();
    }
    private boolean inRange(LocalDate date, Scope scope) {
        return !date.isBefore(scope.dateFrom()) && !date.isAfter(scope.dateTo());
    }
}
