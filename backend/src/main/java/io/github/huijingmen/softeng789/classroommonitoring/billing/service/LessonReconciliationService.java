package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LearningEntitlementStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentSessionPackage;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentLearningEntitlement;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonReconciliationResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationCellResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationSessionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationView;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentSessionPackageRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentLearningEntitlementRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class LessonReconciliationService {
    private static final int MAX_PAGE_SIZE = 100;

    private final CourseOfferingRepository offeringRepository;
    private final ClassroomSessionRepository sessionRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final AttendanceRecordRepository attendanceRepository;
    private final StudentSessionPackageRepository packageRepository;
    private final StudentLearningEntitlementRepository entitlementRepository;
    private final LessonCreditService creditService;

    public LessonReconciliationService(
            CourseOfferingRepository offeringRepository,
            ClassroomSessionRepository sessionRepository,
            CourseEnrollmentRepository enrollmentRepository,
            AttendanceRecordRepository attendanceRepository,
            StudentSessionPackageRepository packageRepository,
            StudentLearningEntitlementRepository entitlementRepository,
            LessonCreditService creditService
    ) {
        this.offeringRepository = offeringRepository;
        this.sessionRepository = sessionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.attendanceRepository = attendanceRepository;
        this.packageRepository = packageRepository;
        this.entitlementRepository = entitlementRepository;
        this.creditService = creditService;
    }

    /** Compatibility entry point used by weekly exports and service-level tests. */
    @Transactional
    public LessonReconciliationResponse weekly(
            UUID offeringId,
            LocalDate requestedWeekStart,
            String query,
            boolean exceptionsOnly,
            int page,
            int size
    ) {
        return reconcile(offeringId, requestedWeekStart, ReconciliationView.WEEK, query, exceptionsOnly, page, size);
    }

    @Transactional
    public LessonReconciliationResponse reconcile(
            UUID offeringId,
            LocalDate requestedWeekStart,
            ReconciliationView view,
            String query,
            boolean exceptionsOnly,
            int page,
            int size
    ) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid reconciliation page request.");
        }
        return reconcile(offeringId, requestedWeekStart, view, query, exceptionsOnly, page, size, null);
    }

    /** Internal batch boundary: calculates a class once, never walks its HTTP pages. */
    @Transactional
    public LessonReconciliationResponse forStudents(
            UUID offeringId, LocalDate weekStart, ReconciliationView view, Collection<UUID> studentIds
    ) {
        return reconcile(offeringId, weekStart, view, "", false, 0, Integer.MAX_VALUE, studentIds);
    }

    private LessonReconciliationResponse reconcile(
            UUID offeringId, LocalDate requestedWeekStart, ReconciliationView view,
            String query, boolean exceptionsOnly, int page, int size, Collection<UUID> studentIds
    ) {
        CourseOffering offering = offeringRepository.findById(offeringId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
        LocalDate weekStart = (requestedWeekStart == null ? BillingDates.today() : requestedWeekStart)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<ClassroomSession> allSessions = sessionRepository
                .findByCourseOffering_IdInOrderByDateAscStartTimeAsc(List.of(offeringId));
        List<ClassroomSession> sessions = view == ReconciliationView.COURSE
                ? allSessions
                : allSessions.stream()
                        .filter(session -> !session.getDate().isBefore(weekStart))
                        .filter(session -> !session.getDate().isAfter(weekStart.plusDays(6)))
                        .toList();
        LocalDate periodStart = view == ReconciliationView.COURSE && !sessions.isEmpty()
                ? sessions.getFirst().getDate()
                : weekStart;
        LocalDate periodEnd = view == ReconciliationView.COURSE && !sessions.isEmpty()
                ? sessions.getLast().getDate()
                : weekStart.plusDays(6);
        List<CourseEnrollment> enrollments = enrollmentRepository
                .findByCourseOffering_IdAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
                        offeringId,
                        CourseEnrollment.EnrollmentStatus.ACTIVE
                ).stream().filter(item -> studentIds == null || studentIds.contains(item.getStudent().getId())).toList();
        List<StudentSessionPackage> packages = packageRepository
                .findByCourseOffering_IdOrderByCreatedAtDesc(offeringId).stream()
                .filter(item -> studentIds == null || studentIds.contains(item.getStudent().getId())).toList();
        List<StudentLearningEntitlement> entitlements = entitlementRepository
                .findByCourseOffering_IdOrderByCreatedAtDesc(offeringId).stream()
                .filter(item -> item.getPurchaseMode() != CoursePurchaseMode.LESSON_PACKAGE)
                .filter(item -> studentIds == null || studentIds.contains(item.getStudent().getId()))
                .toList();
        List<LessonCredit> credits = creditService.creditsForPackages(
                packages.stream().map(StudentSessionPackage::getId).toList()
        );
        Map<UUID, List<LessonCredit>> creditsByPackage = credits.stream()
                .collect(Collectors.groupingBy(credit -> credit.getSessionPackage().getId()));
        Map<UUID, List<StudentSessionPackage>> packagesByStudent = packages.stream()
                .collect(Collectors.groupingBy(item -> item.getStudent().getId()));
        Map<UUID, List<StudentLearningEntitlement>> entitlementsByStudent = entitlements.stream()
                .collect(Collectors.groupingBy(item -> item.getStudent().getId()));
        Map<UUID, AttendanceRecord> attendance = attendanceByStudentAndSession(
                enrollments.stream().map(item -> item.getStudent().getId()).toList(),
                sessions.stream().map(ClassroomSession::getId).toList()
        );

        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        List<ReconciliationRowResponse> matchedRows = enrollments.stream()
                .map(CourseEnrollment::getStudent)
                .filter(student -> matches(student, normalizedQuery))
                .map(student -> row(
                        student,
                        sessions,
                        packagesByStudent.getOrDefault(student.getId(), List.of()),
                        entitlementsByStudent.getOrDefault(student.getId(), List.of()),
                        creditsByPackage,
                        attendance,
                        allSessions
                ))
                .toList();
        ReconciliationSummaryResponse summary = summary(matchedRows, sessions);
        List<ReconciliationRowResponse> visibleRows = matchedRows.stream()
                .filter(row -> !exceptionsOnly || row.needsAttention())
                .toList();

        int from = Math.min(page * size, visibleRows.size());
        int to = Math.min(from + size, visibleRows.size());
        int totalPages = visibleRows.isEmpty() ? 0 : (int) Math.ceil(visibleRows.size() / (double) size);
        return new LessonReconciliationResponse(
                offering.getId(), offering.getCourse().getCode(), offering.getAcademicTerm(),
                view, periodStart, periodEnd,
                sessions.stream().map(this::sessionResponse).toList(),
                summary,
                visibleRows.subList(from, to),
                page, size, visibleRows.size(), totalPages, page > 0, page + 1 < totalPages
        );
    }

    private ReconciliationRowResponse row(
            Student student,
            List<ClassroomSession> sessions,
            List<StudentSessionPackage> studentPackages,
            List<StudentLearningEntitlement> studentEntitlements,
            Map<UUID, List<LessonCredit>> creditsByPackage,
            Map<UUID, AttendanceRecord> attendance,
            List<ClassroomSession> allSessions
    ) {
        List<LessonCredit> credits = studentPackages.stream()
                .flatMap(item -> creditsByPackage.getOrDefault(item.getId(), List.of()).stream())
                .toList();
        List<ReconciliationCellResponse> cells = sessions.stream()
                .map(session -> cell(
                        student,
                        session,
                        credits,
                        studentEntitlements,
                        attendance.get(pairKey(student.getId(), session.getId()))
                ))
                .toList();
        int used = (int) credits.stream().filter(this::used).count();
        int makeupDue = (int) credits.stream()
                .filter(credit -> credit.getStatus() == LessonCreditStatus.MAKEUP_DUE)
                .count();
        int purchased = studentPackages.stream()
                .filter(item -> item.getInvoice().getStatus() != InvoiceStatus.CANCELLED)
                .mapToInt(StudentSessionPackage::getPurchasedSessions)
                .sum() + studentEntitlements.stream()
                .filter(item -> item.getStatus() != LearningEntitlementStatus.CANCELLED)
                .mapToInt(item -> item.getSessionAllowance() == null
                        ? (int) allSessions.stream().filter(session -> covers(item, session)).count()
                        : item.getSessionAllowance())
                .sum();
        int pending = (int) credits.stream()
                .filter(credit -> credit.getStatus() == LessonCreditStatus.PENDING_PAYMENT)
                .count();
        int active = (int) credits.stream()
                .filter(credit -> credit.getStatus() != LessonCreditStatus.PENDING_PAYMENT)
                .filter(credit -> credit.getStatus() != LessonCreditStatus.VOID)
                .count();
        int remaining = (int) credits.stream().filter(this::remaining).count();
        LocalDate today = BillingDates.today();
        LocalDate expiryWindowEnd = today.plusDays(14);
        int expiring = (int) credits.stream()
                .filter(this::remaining)
                .filter(credit -> !credit.getExpiresOn().isBefore(today))
                .filter(credit -> !credit.getExpiresOn().isAfter(expiryWindowEnd))
                .count();
        int uncovered = (int) cells.stream().filter(ReconciliationCellResponse::uncoveredAttendance).count();
        StudentSessionPackage latestPackage = studentPackages.isEmpty()
                ? null
                : studentPackages.getFirst();
        List<StudentInvoice> invoices = invoices(studentPackages, studentEntitlements);
        StudentInvoice invoice = invoices.isEmpty() ? null : invoices.getFirst();
        InvoiceStatus paymentStatus = aggregatePaymentStatus(invoices);
        java.math.BigDecimal balance = invoices.stream()
                .filter(item -> InvoiceStatusPolicy.current(item).isOpen())
                .map(InvoiceAmounts::balance)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        boolean paymentIssue = InvoiceStatusPolicy.needsPaymentAction(paymentStatus);
        boolean attendanceIssue = cells.stream().anyMatch(cell -> isUnrecorded(cell, sessions));
        boolean needsAttention = paymentIssue || makeupDue > 0 || expiring > 0 || attendanceIssue || uncovered > 0;
        return new ReconciliationRowResponse(
                student.getId(), student.getFullName(), student.getStudentNumber(),
                latestPackage == null ? null : latestPackage.getId(),
                invoice == null ? null : invoice.getId(),
                paymentStatus,
                invoices.isEmpty() ? null : balance,
                invoice == null ? "NZD" : invoice.getCurrency(),
                latestPackage != null
                        ? CoursePurchaseMode.LESSON_PACKAGE
                        : studentEntitlements.isEmpty() ? null : studentEntitlements.getFirst().getPurchaseMode(),
                purchased,
                active,
                pending,
                used,
                remaining,
                makeupDue,
                expiring,
                uncovered,
                needsAttention,
                cells
        );
    }

    private ReconciliationCellResponse cell(
            Student student,
            ClassroomSession session,
            List<LessonCredit> credits,
            List<StudentLearningEntitlement> entitlements,
            AttendanceRecord attendance
    ) {
        LessonCredit credit = credits.stream()
                .filter(item -> item.getOriginalSession() != null
                        && item.getOriginalSession().getId().equals(session.getId()))
                .findFirst()
                .orElseGet(() -> credits.stream()
                        .filter(item -> item.getCurrentSession() != null
                                && item.getCurrentSession().getId().equals(session.getId()))
                        .findFirst()
                        .orElse(null));
        LessonCreditStatus entitlementStatus = credit == null
                ? coverageStatus(session, attendance, entitlements)
                : null;
        ClassroomSession original = credit == null ? null : credit.getOriginalSession();
        ClassroomSession current = credit == null ? null : credit.getCurrentSession();
        boolean hasMakeup = original != null && current != null && !original.getId().equals(current.getId());
        var attendanceReason = attendance == null ? null : attendance.getAbsenceReason();
        var attendanceNote = attendance == null ? null : attendance.getAbsenceNote();
        return new ReconciliationCellResponse(
                session.getId(),
                attendance == null ? null : attendance.getId(),
                attendance == null ? AttendanceStatus.UNKNOWN : attendance.getStatus(),
                credit == null ? null : credit.getId(),
                credit == null ? entitlementStatus : credit.getStatus(),
                attendanceReason != null ? attendanceReason : credit == null ? null : credit.getAbsenceReason(),
                attendanceNote,
                credit == null ? null : credit.getDecisionNote(),
                original == null ? null : original.getId(),
                original == null ? null : original.getDate(),
                hasMakeup ? current.getId() : null,
                hasMakeup ? current.getDate() : null,
                attendance != null
                        && attendance.getStatus() != AttendanceStatus.UNKNOWN
                        && credit == null
                        && entitlementStatus == null
        );
    }

    private LessonCreditStatus coverageStatus(
            ClassroomSession session,
            AttendanceRecord attendance,
            List<StudentLearningEntitlement> entitlements
    ) {
        StudentLearningEntitlement entitlement = entitlements.stream()
                .filter(item -> covers(item, session))
                .findFirst()
                .orElse(null);
        if (entitlement == null) return null;
        if (entitlement.getStatus() == LearningEntitlementStatus.PENDING_PAYMENT) {
            return LessonCreditStatus.PENDING_PAYMENT;
        }
        if (entitlement.getStatus() == LearningEntitlementStatus.CANCELLED
                || entitlement.getStatus() == LearningEntitlementStatus.EXPIRED) {
            return null;
        }
        return LessonCreditStatus.BOOKED;
    }

    private boolean covers(StudentLearningEntitlement entitlement, ClassroomSession session) {
        if (entitlement.getStatus() == LearningEntitlementStatus.CANCELLED) return false;
        if (entitlement.getPurchaseMode() == CoursePurchaseMode.PAY_PER_LESSON) {
            return entitlement.getClassroomSession() != null
                    && entitlement.getClassroomSession().getId().equals(session.getId());
        }
        return (entitlement.getValidFrom() == null || !session.getDate().isBefore(entitlement.getValidFrom()))
                && (entitlement.getValidTo() == null || !session.getDate().isAfter(entitlement.getValidTo()));
    }

    private List<StudentInvoice> invoices(
            List<StudentSessionPackage> packages,
            List<StudentLearningEntitlement> entitlements
    ) {
        Map<UUID, StudentInvoice> unique = new LinkedHashMap<>();
        packages.forEach(item -> unique.putIfAbsent(item.getInvoice().getId(), item.getInvoice()));
        entitlements.stream()
                .filter(item -> item.getInvoice() != null)
                .forEach(item -> unique.putIfAbsent(item.getInvoice().getId(), item.getInvoice()));
        return List.copyOf(unique.values());
    }

    private Map<UUID, AttendanceRecord> attendanceByStudentAndSession(
            Collection<UUID> studentIds,
            Collection<UUID> sessionIds
    ) {
        if (studentIds.isEmpty() || sessionIds.isEmpty()) return Map.of();
        Map<UUID, AttendanceRecord> result = new HashMap<>();
        attendanceRepository.findByStudent_IdInAndSession_IdIn(studentIds, sessionIds)
                .forEach(record -> result.put(pairKey(
                        record.getStudent().getId(), record.getSession().getId()
                ), record));
        return result;
    }

    private ReconciliationSummaryResponse summary(
            List<ReconciliationRowResponse> rows,
            List<ClassroomSession> sessions
    ) {
        int paymentIssues = (int) rows.stream()
                .filter(row -> InvoiceStatusPolicy.needsPaymentAction(row.paymentStatus()))
                .count();
        int makeupDue = rows.stream().mapToInt(ReconciliationRowResponse::makeupDue).sum();
        int expiring = rows.stream().mapToInt(ReconciliationRowResponse::expiringSessions).sum();
        int notRecorded = (int) rows.stream()
                .flatMap(row -> row.cells().stream())
                .filter(cell -> isUnrecorded(cell, sessions))
                .count();
        int uncovered = rows.stream().mapToInt(ReconciliationRowResponse::uncoveredAttendance).sum();
        int fullyReconciled = (int) rows.stream().filter(row -> !row.needsAttention()).count();
        return new ReconciliationSummaryResponse(
                rows.size(), fullyReconciled, paymentIssues, makeupDue, expiring, notRecorded, uncovered
        );
    }

    private boolean isUnrecorded(
            ReconciliationCellResponse cell,
            List<ClassroomSession> sessions
    ) {
        return cell.attendanceStatus() == AttendanceStatus.UNKNOWN
                && sessions.stream().anyMatch(session -> session.getId().equals(cell.sessionId())
                        && session.getStatus() == SessionStatus.COMPLETED);
    }

    private ReconciliationSessionResponse sessionResponse(ClassroomSession session) {
        Room room = session.getRoomEntity();
        return new ReconciliationSessionResponse(
                session.getId(), session.getDate(), session.getStartTime(), session.getEndTime(), session.getStatus(),
                room == null ? session.getRoom() : room.getName(),
                room == null ? null : room.getCampus().getName()
        );
    }

    private boolean matches(Student student, String query) {
        if (query.isBlank()) return true;
        return (student.getFullName() + " " + student.getStudentNumber()).toLowerCase(Locale.ROOT).contains(query);
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

    private InvoiceStatus aggregatePaymentStatus(List<StudentInvoice> invoices) {
        if (invoices.isEmpty()) return null;
        List<InvoiceStatus> statuses = invoices.stream()
                .map(InvoiceStatusPolicy::current)
                .toList();
        if (statuses.contains(InvoiceStatus.OVERDUE)) return InvoiceStatus.OVERDUE;
        if (statuses.contains(InvoiceStatus.PARTIALLY_PAID)) return InvoiceStatus.PARTIALLY_PAID;
        if (statuses.contains(InvoiceStatus.DRAFT)) return InvoiceStatus.DRAFT;
        if (statuses.contains(InvoiceStatus.PENDING)) return InvoiceStatus.PENDING;
        if (statuses.stream().allMatch(status -> status == InvoiceStatus.CANCELLED)) return InvoiceStatus.CANCELLED;
        return InvoiceStatus.PAID;
    }

    private UUID pairKey(UUID studentId, UUID sessionId) {
        return UUID.nameUUIDFromBytes((studentId + ":" + sessionId).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
