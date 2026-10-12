package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonMakeupRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonMakeupRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonMakeupRequestRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentSessionPackage;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentSessionPackageRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.LessonCreditService;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentScheduleDtos.CoverageStatus;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentScheduleDtos.StudentScheduleResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentScheduleDtos.StudentScheduleSessionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentScheduleDtos.StudentScheduleSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestType;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentSupportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.support.repository.StudentSupportRequestRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudentScheduleService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Pacific/Auckland");
    private final CourseEnrollmentRepository enrollmentRepository;
    private final ClassroomSessionRepository sessionRepository;
    private final AttendanceRecordRepository attendanceRepository;
    private final StudentSessionPackageRepository packageRepository;
    private final LessonCreditService creditService;
    private final LessonMakeupRequestRepository makeupRequestRepository;
    private final StudentSupportRequestRepository supportRequestRepository;

    public StudentScheduleService(
            CourseEnrollmentRepository enrollmentRepository,
            ClassroomSessionRepository sessionRepository,
            AttendanceRecordRepository attendanceRepository,
            StudentSessionPackageRepository packageRepository,
            LessonCreditService creditService,
            LessonMakeupRequestRepository makeupRequestRepository,
            StudentSupportRequestRepository supportRequestRepository
    ) {
        this.enrollmentRepository = enrollmentRepository;
        this.sessionRepository = sessionRepository;
        this.attendanceRepository = attendanceRepository;
        this.packageRepository = packageRepository;
        this.creditService = creditService;
        this.makeupRequestRepository = makeupRequestRepository;
        this.supportRequestRepository = supportRequestRepository;
    }

    /** One read model for the student's calendar and lesson-account state. The browser never joins
     * privileged teacher endpoints or infers payment coverage from invoice amounts. */
    @Transactional
    public StudentScheduleResponse schedule(UUID studentId) {
        List<UUID> offeringIds = enrollmentRepository.findByStudent_IdAndStatus(studentId, EnrollmentStatus.ACTIVE)
                .stream()
                .map(enrollment -> enrollment.getCourseOffering().getId())
                .toList();
        if (offeringIds.isEmpty()) {
            return new StudentScheduleResponse(studentId, emptySummary(), List.of());
        }

        List<ClassroomSession> sessions = sessionRepository
                .findByCourseOffering_IdInOrderByDateAscStartTimeAsc(offeringIds);
        Map<UUID, AttendanceRecord> attendanceBySession = attendanceBySession(studentId, sessions);
        List<StudentSessionPackage> packages = packageRepository
                .findByStudent_IdAndCourseOffering_IdInOrderByCreatedAtAsc(studentId, offeringIds)
                .stream()
                .filter(sessionPackage -> sessionPackage.getInvoice().getStatus() != InvoiceStatus.DRAFT)
                .toList();
        List<LessonCredit> credits = creditService.creditsForPackages(
                packages.stream().map(StudentSessionPackage::getId).toList()
        );
        Map<UUID, LessonCredit> currentCredits = new HashMap<>();
        Map<UUID, LessonCredit> originalCredits = new HashMap<>();
        credits.forEach(credit -> {
            if (credit.getCurrentSession() != null) {
                currentCredits.putIfAbsent(credit.getCurrentSession().getId(), credit);
            }
            if (credit.getOriginalSession() != null) {
                originalCredits.putIfAbsent(credit.getOriginalSession().getId(), credit);
            }
        });
        Map<UUID, LessonMakeupRequest> pendingRequests = credits.isEmpty()
                ? Map.of()
                : makeupRequestRepository.findByLessonCredit_IdInAndStatus(
                        credits.stream().map(LessonCredit::getId).toList(),
                        LessonMakeupRequestStatus.SUBMITTED
                ).stream().collect(java.util.stream.Collectors.toMap(
                        request -> request.getLessonCredit().getId(),
                        request -> request,
                        (first, ignored) -> first
                ));
        Map<UUID, StudentSupportRequest> leaveRequests = supportRequestRepository
                .findByStudent_IdOrderBySubmittedAtDesc(studentId).stream()
                .filter(request -> request.getType() == StudentRequestType.LEAVE)
                .filter(request -> request.getSession() != null)
                .filter(request -> request.getStatus() == StudentRequestStatus.SUBMITTED
                        || request.getStatus() == StudentRequestStatus.APPROVED)
                .collect(java.util.stream.Collectors.toMap(
                        request -> request.getSession().getId(),
                        request -> request,
                        (newest, ignored) -> newest
                ));

        List<StudentScheduleSessionResponse> rows = sessions.stream()
                .map(session -> row(
                        session,
                        attendanceBySession.get(session.getId()),
                        currentCredits.get(session.getId()),
                        originalCredits.get(session.getId()),
                        requestFor(session, currentCredits, originalCredits, pendingRequests),
                        leaveRequests.get(session.getId())
                ))
                .toList();
        return new StudentScheduleResponse(studentId, summary(rows, packages, credits), rows);
    }

    private Map<UUID, AttendanceRecord> attendanceBySession(
            UUID studentId,
            Collection<ClassroomSession> sessions
    ) {
        if (sessions.isEmpty()) return Map.of();
        Map<UUID, AttendanceRecord> result = new HashMap<>();
        attendanceRepository.findByStudent_IdInAndSession_IdIn(
                List.of(studentId), sessions.stream().map(ClassroomSession::getId).toList()
        ).forEach(record -> result.put(record.getSession().getId(), record));
        return result;
    }

    private StudentScheduleSessionResponse row(
            ClassroomSession session,
            AttendanceRecord attendance,
            LessonCredit currentCredit,
            LessonCredit originalCredit,
            LessonMakeupRequest makeupRequest,
            StudentSupportRequest leaveRequest
    ) {
        LessonCredit visibleCredit = currentCredit != null ? currentCredit : originalCredit;
        CoverageStatus coverage = coverage(session, attendance, currentCredit, originalCredit);
        ClassroomSession related = relatedSession(session, currentCredit, originalCredit);
        Room room = session.getRoomEntity();
        var offering = session.getCourseOffering();
        var course = offering.getCourse();
        return new StudentScheduleSessionResponse(
                session.getId(),
                offering.getId(),
                course.getCode(),
                course.getName(),
                offering.getOfferingCode(),
                offering.getAcademicTerm(),
                session.getDate(),
                session.getStartTime(),
                session.getEndTime(),
                session.getStatus(),
                room == null ? session.getRoom() : room.getName(),
                room == null ? null : room.getCampus().getName(),
                session.getTeacher() == null ? null : session.getTeacher().getName(),
                attendance == null ? AttendanceStatus.UNKNOWN : attendance.getStatus(),
                visibleCredit == null ? null : visibleCredit.getId(),
                visibleCredit == null ? null : visibleCredit.getStatus(),
                coverage,
                related == null ? null : related.getId(),
                related == null ? null : related.getDate(),
                visibleCredit == null ? null : visibleCredit.getExpiresOn(),
                makeupRequest == null ? null : makeupRequest.getId(),
                makeupRequest == null ? null : makeupRequest.getStatus(),
                makeupRequest == null ? null : makeupRequest.getPreferredSession().getDate(),
                leaveRequest == null ? null : leaveRequest.getId(),
                leaveRequest == null ? null : leaveRequest.getStatus(),
                leaveRequest == null ? null : leaveRequest.getLeaveReason()
        );
    }

    private LessonMakeupRequest requestFor(
            ClassroomSession session,
            Map<UUID, LessonCredit> currentCredits,
            Map<UUID, LessonCredit> originalCredits,
            Map<UUID, LessonMakeupRequest> requests
    ) {
        LessonCredit credit = currentCredits.get(session.getId());
        if (credit == null) credit = originalCredits.get(session.getId());
        return credit == null ? null : requests.get(credit.getId());
    }

    private CoverageStatus coverage(
            ClassroomSession session,
            AttendanceRecord attendance,
            LessonCredit currentCredit,
            LessonCredit originalCredit
    ) {
        if (session.getStatus() == SessionStatus.CANCELLED) return CoverageStatus.NOT_REQUIRED;
        LessonCredit credit = currentCredit != null ? currentCredit : originalCredit;
        if (credit == null) {
            return attendance != null && attendance.getStatus() != AttendanceStatus.UNKNOWN
                    ? CoverageStatus.UNPAID_ATTENDANCE
                    : CoverageStatus.UNCOVERED;
        }
        return switch (credit.getStatus()) {
            case USED -> CoverageStatus.USED;
            case COUNTED_ABSENCE -> CoverageStatus.COUNTED_ABSENCE;
            case MAKEUP_DUE -> CoverageStatus.MAKEUP_DUE;
            case MAKEUP_SCHEDULED -> CoverageStatus.MAKEUP_SCHEDULED;
            case BOOKED, AVAILABLE -> CoverageStatus.COVERED;
            case PENDING_PAYMENT -> CoverageStatus.UNCOVERED;
            case EXPIRED, VOID -> CoverageStatus.UNCOVERED;
        };
    }

    private ClassroomSession relatedSession(
            ClassroomSession session,
            LessonCredit currentCredit,
            LessonCredit originalCredit
    ) {
        LessonCredit credit = currentCredit != null ? currentCredit : originalCredit;
        if (credit == null || credit.getOriginalSession() == null || credit.getCurrentSession() == null) return null;
        if (credit.getOriginalSession().getId().equals(credit.getCurrentSession().getId())) return null;
        return session.getId().equals(credit.getOriginalSession().getId())
                ? credit.getCurrentSession()
                : credit.getOriginalSession();
    }

    private StudentScheduleSummaryResponse summary(
            List<StudentScheduleSessionResponse> rows,
            List<StudentSessionPackage> packages,
            List<LessonCredit> credits
    ) {
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        int upcoming = (int) rows.stream().filter(row -> !row.date().isBefore(today))
                .filter(row -> row.status() != SessionStatus.CANCELLED).count();
        int coveredUpcoming = (int) rows.stream().filter(row -> !row.date().isBefore(today))
                .filter(row -> row.coverageStatus() == CoverageStatus.COVERED
                        || row.coverageStatus() == CoverageStatus.MAKEUP_SCHEDULED)
                .count();
        int uncoveredUpcoming = (int) rows.stream().filter(row -> !row.date().isBefore(today))
                .filter(row -> row.status() != SessionStatus.CANCELLED)
                .filter(row -> row.coverageStatus() == CoverageStatus.UNCOVERED)
                .count();
        int purchased = packages.stream()
                .filter(item -> item.getStatus()
                        != io.github.huijingmen.softeng789.classroommonitoring.billing.domain.SessionPackageStatus.CANCELLED)
                .mapToInt(StudentSessionPackage::getPurchasedSessions)
                .sum();
        int active = (int) credits.stream().filter(this::active).count();
        int used = (int) credits.stream().filter(this::used).count();
        int remaining = (int) credits.stream().filter(this::remaining).count();
        int pending = (int) credits.stream()
                .filter(credit -> credit.getStatus() == LessonCreditStatus.PENDING_PAYMENT).count();
        int makeupDue = (int) credits.stream()
                .filter(credit -> credit.getStatus() == LessonCreditStatus.MAKEUP_DUE).count();
        LocalDate expiryWindowEnd = today.plusDays(14);
        List<LessonCredit> expiring = credits.stream()
                .filter(this::remaining)
                .filter(credit -> !credit.getExpiresOn().isBefore(today))
                .filter(credit -> !credit.getExpiresOn().isAfter(expiryWindowEnd))
                .toList();
        int planned = (int) rows.stream().filter(row -> row.status() != SessionStatus.CANCELLED).count();
        return new StudentScheduleSummaryResponse(
                planned, upcoming, coveredUpcoming, uncoveredUpcoming,
                purchased, active, used, remaining, pending, makeupDue,
                expiring.size(), expiring.stream().map(LessonCredit::getExpiresOn).min(LocalDate::compareTo).orElse(null)
        );
    }

    private boolean active(LessonCredit credit) {
        return credit.getStatus() != LessonCreditStatus.PENDING_PAYMENT
                && credit.getStatus() != LessonCreditStatus.VOID;
    }

    private boolean used(LessonCredit credit) {
        return credit.getStatus() == LessonCreditStatus.USED
                || credit.getStatus() == LessonCreditStatus.COUNTED_ABSENCE;
    }

    private boolean remaining(LessonCredit credit) {
        return credit.getStatus() == LessonCreditStatus.AVAILABLE
                || credit.getStatus() == LessonCreditStatus.BOOKED
                || credit.getStatus() == LessonCreditStatus.MAKEUP_DUE
                || credit.getStatus() == LessonCreditStatus.MAKEUP_SCHEDULED;
    }

    private StudentScheduleSummaryResponse emptySummary() {
        return new StudentScheduleSummaryResponse(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null);
    }
}
