package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AbsenceBillingPolicy;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AttendanceBillingDecision;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AttendanceBillingOverride;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.SessionPackageStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentLearningEntitlement;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentSessionPackage;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LearningEntitlementRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SessionPackageUsageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SessionUsageEntryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.UpdateAttendanceBillingRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.AttendanceBillingOverrideRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentSessionPackageRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class SessionPackageService {
    private final StudentSessionPackageRepository packageRepository;
    private final AttendanceBillingOverrideRepository overrideRepository;
    private final AttendanceRecordRepository attendanceRepository;
    private final ClassroomSessionRepository sessionRepository;
    private final CourseOfferingRepository offeringRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final TeacherRepository teacherRepository;
    private final LessonCreditService lessonCreditService;
    private final LessonCreditManagementService lessonCreditManagementService;

    public SessionPackageService(
            StudentSessionPackageRepository packageRepository,
            AttendanceBillingOverrideRepository overrideRepository,
            AttendanceRecordRepository attendanceRepository,
            ClassroomSessionRepository sessionRepository,
            CourseOfferingRepository offeringRepository,
            CourseEnrollmentRepository enrollmentRepository,
            TeacherRepository teacherRepository,
            LessonCreditService lessonCreditService,
            LessonCreditManagementService lessonCreditManagementService
    ) {
        this.packageRepository = packageRepository;
        this.overrideRepository = overrideRepository;
        this.attendanceRepository = attendanceRepository;
        this.sessionRepository = sessionRepository;
        this.offeringRepository = offeringRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.teacherRepository = teacherRepository;
        this.lessonCreditService = lessonCreditService;
        this.lessonCreditManagementService = lessonCreditManagementService;
    }

    @Transactional
    public void createForInvoices(
            List<StudentInvoice> invoices,
            LearningEntitlementRequest request,
            Map<UUID, StudentLearningEntitlement> entitlementsByInvoice
    ) {
        if (request == null || request.purchaseMode() != CoursePurchaseMode.LESSON_PACKAGE) return;
        validateDates(request);
        CourseOffering offering = offeringRepository.findById(request.courseOfferingId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
        for (StudentInvoice invoice : invoices) {
            if (!enrollmentRepository.existsByStudent_IdAndCourseOffering_IdAndStatus(
                    invoice.getStudent().getId(), offering.getId(), EnrollmentStatus.ACTIVE)) {
                throw new ResponseStatusException(BAD_REQUEST,
                        invoice.getStudent().getFullName() + " is not actively enrolled in the selected class.");
            }
        }
        List<StudentSessionPackage> saved = packageRepository.saveAll(
                invoices.stream().map(invoice -> createPackage(
                        invoice, offering, request, entitlementsByInvoice.get(invoice.getId())
                )).toList()
        );
        lessonCreditService.createForPackages(saved);
    }

    @Transactional
    public void createForInvoices(List<StudentInvoice> invoices, LearningEntitlementRequest request) {
        createForInvoices(invoices, request, Map.of());
    }

    /** Converts a fully paid invoice into usable lesson rights. Partial payments remain financial
     * progress only; they never silently grant a fraction of a package. */
    @Transactional
    public void activateForInvoice(StudentInvoice invoice) {
        if (invoice.getStatus() != InvoiceStatus.PAID) return;
        packageRepository.findByInvoice_IdOrderByCreatedAtAsc(invoice.getId()).forEach(sessionPackage -> {
            if (sessionPackage.getStatus() != SessionPackageStatus.PENDING_PAYMENT) return;
            sessionPackage.setStatus(SessionPackageStatus.ACTIVE);
            packageRepository.save(sessionPackage);
            lessonCreditService.activatePackage(sessionPackage);
        });
    }

    @Transactional
    public Map<UUID, SessionPackageUsageResponse> summarizeForInvoices(Collection<UUID> invoiceIds) {
        return summarizeAllForInvoices(invoiceIds).entrySet().stream()
                .filter(entry -> !entry.getValue().isEmpty())
                .collect(Collectors.toMap(Map.Entry::getKey, entry -> entry.getValue().getFirst()));
    }

    @Transactional
    public Map<UUID, List<SessionPackageUsageResponse>> summarizeAllForInvoices(Collection<UUID> invoiceIds) {
        if (invoiceIds.isEmpty()) return Map.of();
        return packageRepository.findByInvoice_IdIn(invoiceIds).stream()
                .collect(Collectors.groupingBy(
                        item -> item.getInvoice().getId(),
                        Collectors.mapping(this::summarize, Collectors.toList())
                ));
    }

    @Transactional
    public SessionPackageUsageResponse summarizePackage(UUID packageId) {
        StudentSessionPackage sessionPackage = packageRepository.findById(packageId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Session package not found."));
        return summarize(sessionPackage);
    }

    @Transactional
    public SessionPackageUsageResponse updateAttendanceDecision(
            UUID adminId,
            UUID packageId,
            UUID attendanceRecordId,
            UpdateAttendanceBillingRequest request
    ) {
        StudentSessionPackage sessionPackage = packageRepository.findById(packageId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Session package not found."));
        AttendanceRecord record = attendanceRepository.findById(attendanceRecordId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Attendance record not found."));
        assertRecordBelongsToPackage(sessionPackage, record);
        Teacher admin = teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));

        AttendanceBillingOverride override = overrideRepository.findByAttendanceRecord_Id(attendanceRecordId)
                .orElseGet(AttendanceBillingOverride::new);
        override.setAttendanceRecord(record);
        override.setDecision(request.decision());
        override.setReason(request.reason().trim());
        override.setUpdatedByAdmin(admin);
        overrideRepository.save(override);
        lessonCreditManagementService.applyLegacyBillingOverride(
                sessionPackage.getId(), record, request.decision(), request.reason().trim(), admin
        );
        return summarize(sessionPackage);
    }

    private StudentSessionPackage createPackage(
            StudentInvoice invoice,
            CourseOffering offering,
            LearningEntitlementRequest request,
            StudentLearningEntitlement entitlement
    ) {
        StudentSessionPackage result = new StudentSessionPackage();
        result.setInvoice(invoice);
        result.setStudent(invoice.getStudent());
        result.setCourseOffering(offering);
        result.setEntitlement(entitlement);
        result.setPurchasedSessions(request.includedSessions());
        result.setServiceFrom(request.validFrom());
        result.setServiceTo(request.validTo());
        result.setAbsencePolicy(request.absencePolicy());
        result.setStatus(invoice.getStatus() == InvoiceStatus.PAID
                ? SessionPackageStatus.ACTIVE
                : SessionPackageStatus.PENDING_PAYMENT);
        return result;
    }

    private void validateDates(LearningEntitlementRequest request) {
        if (request.validFrom() == null || request.validTo() == null || request.includedSessions() == null
                || request.absencePolicy() == null) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Lesson packages require a lesson count, validity dates and an absence policy.");
        }
        if (request.validTo().isBefore(request.validFrom())) {
            throw new ResponseStatusException(BAD_REQUEST, "Session package end date must be on or after its start date.");
        }
    }

    private SessionPackageUsageResponse summarize(StudentSessionPackage sessionPackage) {
        List<LessonCredit> credits = lessonCreditService.creditsForPackages(List.of(sessionPackage.getId()));
        if (!credits.isEmpty()) {
            return summarizeCredits(sessionPackage, credits);
        }
        List<ClassroomSession> sessions = sessionRepository
                .findByCourseOffering_IdAndDateBetweenAndStatusOrderByDateAscStartTimeAsc(
                        sessionPackage.getCourseOffering().getId(),
                        sessionPackage.getServiceFrom(),
                        sessionPackage.getServiceTo(),
                        SessionStatus.COMPLETED
                );
        Map<UUID, AttendanceRecord> attendanceBySession = attendanceRepository.findPackageAttendance(
                        sessionPackage.getStudent().getId(),
                        sessionPackage.getCourseOffering().getId(),
                        sessionPackage.getServiceFrom(),
                        sessionPackage.getServiceTo()
                ).stream()
                .collect(Collectors.toMap(record -> record.getSession().getId(), Function.identity()));
        List<UUID> recordIds = attendanceBySession.values().stream().map(AttendanceRecord::getId).toList();
        Map<UUID, AttendanceBillingOverride> overrides = recordIds.isEmpty()
                ? Map.of()
                : overrideRepository.findByAttendanceRecord_IdIn(recordIds).stream()
                        .collect(Collectors.toMap(item -> item.getAttendanceRecord().getId(), Function.identity()));

        List<SessionUsageEntryResponse> entries = sessions.stream()
                .map(session -> toEntry(sessionPackage, session, attendanceBySession.get(session.getId()), overrides))
                .toList();
        int attended = (int) entries.stream().filter(this::isAttended).count();
        int chargeableAbsences = (int) entries.stream().filter(this::isChargeableAbsence).count();
        int waivedAbsences = (int) entries.stream().filter(this::isWaivedAbsence).count();
        int unrecorded = (int) entries.stream().filter(entry -> entry.attendanceStatus() == AttendanceStatus.UNKNOWN).count();
        int used = (int) entries.stream().filter(SessionUsageEntryResponse::consumesSession).count();
        int remaining = sessionPackage.getStatus() == SessionPackageStatus.ACTIVE
                ? Math.max(sessionPackage.getPurchasedSessions() - used, 0)
                : 0;
        CourseOffering offering = sessionPackage.getCourseOffering();

        return new SessionPackageUsageResponse(
                sessionPackage.getId(), entitlementId(sessionPackage), offering.getId(),
                offering.getCourse().getCode(), offering.getAcademicTerm(),
                sessionPackage.getPurchasedSessions(), used, remaining, attended, chargeableAbsences,
                waivedAbsences, unrecorded, sessionPackage.getServiceFrom(), sessionPackage.getServiceTo(),
                sessionPackage.getAbsencePolicy(), packageStatus(sessionPackage, remaining, credits), entries
        );
    }

    private SessionPackageUsageResponse summarizeCredits(
            StudentSessionPackage sessionPackage,
            List<LessonCredit> credits
    ) {
        int attended = (int) credits.stream()
                .filter(credit -> credit.getStatus() == LessonCreditStatus.USED)
                .count();
        int chargeableAbsences = (int) credits.stream()
                .filter(credit -> credit.getStatus() == LessonCreditStatus.COUNTED_ABSENCE)
                .count();
        int waivedAbsences = (int) credits.stream()
                .filter(credit -> credit.getStatus() == LessonCreditStatus.MAKEUP_DUE
                        || credit.getStatus() == LessonCreditStatus.MAKEUP_SCHEDULED)
                .count();
        int unrecorded = (int) credits.stream()
                .filter(credit -> credit.getStatus() == LessonCreditStatus.BOOKED)
                .filter(credit -> credit.getCurrentSession() != null
                        && credit.getCurrentSession().getStatus() == SessionStatus.COMPLETED)
                .filter(credit -> credit.getSourceAttendanceRecord() == null
                        || credit.getSourceAttendanceRecord().getStatus() == AttendanceStatus.UNKNOWN)
                .count();
        int used = attended + chargeableAbsences;
        int remaining = (int) credits.stream().filter(this::isUsable).count();
        CourseOffering offering = sessionPackage.getCourseOffering();
        List<SessionUsageEntryResponse> entries = credits.stream().map(credit -> {
            ClassroomSession current = credit.getCurrentSession();
            ClassroomSession original = credit.getOriginalSession();
            AttendanceRecord attendance = credit.getSourceAttendanceRecord();
            boolean makeup = current != null && original != null && !current.getId().equals(original.getId());
            AttendanceBillingDecision decision = switch (credit.getStatus()) {
                case COUNTED_ABSENCE -> AttendanceBillingDecision.CONSUME;
                case MAKEUP_DUE, MAKEUP_SCHEDULED -> AttendanceBillingDecision.WAIVE;
                default -> null;
            };
            return new SessionUsageEntryResponse(
                    attendance == null ? null : attendance.getId(),
                    current == null ? null : current.getId(),
                    current == null ? null : current.getDate(),
                    attendance == null ? AttendanceStatus.UNKNOWN : attendance.getStatus(),
                    credit.getStatus() == LessonCreditStatus.USED
                            || credit.getStatus() == LessonCreditStatus.COUNTED_ABSENCE,
                    decision,
                    credit.getDecisionNote(),
                    credit.getId(),
                    credit.getStatus(),
                    original == null ? null : original.getId(),
                    original == null ? null : original.getDate(),
                    makeup && current != null ? current.getId() : null,
                    makeup && current != null ? current.getDate() : null
            );
        }).toList();
        return new SessionPackageUsageResponse(
                sessionPackage.getId(), entitlementId(sessionPackage), offering.getId(),
                offering.getCourse().getCode(), offering.getAcademicTerm(),
                sessionPackage.getPurchasedSessions(), used, remaining, attended, chargeableAbsences,
                waivedAbsences, unrecorded, sessionPackage.getServiceFrom(), sessionPackage.getServiceTo(),
                sessionPackage.getAbsencePolicy(), packageStatus(sessionPackage, remaining), entries
        );
    }

    private UUID entitlementId(StudentSessionPackage sessionPackage) {
        return sessionPackage.getEntitlement() == null ? null : sessionPackage.getEntitlement().getId();
    }

    private SessionUsageEntryResponse toEntry(
            StudentSessionPackage sessionPackage,
            ClassroomSession session,
            AttendanceRecord record,
            Map<UUID, AttendanceBillingOverride> overrides
    ) {
        AttendanceStatus status = record == null ? AttendanceStatus.UNKNOWN : record.getStatus();
        AttendanceBillingOverride override = record == null ? null : overrides.get(record.getId());
        boolean consumes = override == null
                ? defaultConsumes(sessionPackage.getAbsencePolicy(), status)
                : override.getDecision() == AttendanceBillingDecision.CONSUME;
        return new SessionUsageEntryResponse(
                record == null ? null : record.getId(), session.getId(), session.getDate(), status, consumes,
                override == null ? null : override.getDecision(), override == null ? null : override.getReason(),
                null, null, session.getId(), session.getDate(), null, null
        );
    }

    private boolean defaultConsumes(AbsenceBillingPolicy policy, AttendanceStatus status) {
        if (status == AttendanceStatus.PRESENT || status == AttendanceStatus.LATE) return true;
        return status == AttendanceStatus.ABSENT && policy == AbsenceBillingPolicy.CONSUME_UNEXCUSED;
    }

    private boolean isAttended(SessionUsageEntryResponse entry) {
        return entry.attendanceStatus() == AttendanceStatus.PRESENT
                || entry.attendanceStatus() == AttendanceStatus.LATE;
    }

    private boolean isChargeableAbsence(SessionUsageEntryResponse entry) {
        return entry.attendanceStatus() == AttendanceStatus.ABSENT && entry.consumesSession();
    }

    private boolean isWaivedAbsence(SessionUsageEntryResponse entry) {
        return entry.attendanceStatus() == AttendanceStatus.ABSENT && !entry.consumesSession();
    }

    private String packageStatus(StudentSessionPackage sessionPackage, int remaining) {
        if (sessionPackage.getStatus() == SessionPackageStatus.CANCELLED) return "CANCELLED";
        if (sessionPackage.getStatus() == SessionPackageStatus.PAUSED) return "PAUSED";
        if (sessionPackage.getStatus() == SessionPackageStatus.PENDING_PAYMENT) return "AWAITING_PAYMENT";
        InvoiceStatus invoiceStatus = sessionPackage.getInvoice().getStatus();
        if (invoiceStatus == InvoiceStatus.CANCELLED) return "CANCELLED";
        if (remaining == 0) return "EXHAUSTED";
        if (sessionPackage.getServiceTo().isBefore(BillingDates.today())) return "EXPIRED";
        if (invoiceStatus == InvoiceStatus.DRAFT
                || invoiceStatus == InvoiceStatus.PENDING
                || invoiceStatus == InvoiceStatus.OVERDUE) {
            return "AWAITING_PAYMENT";
        }
        return "ACTIVE";
    }

    private boolean isUsable(LessonCredit credit) {
        return credit.getStatus() == LessonCreditStatus.AVAILABLE
                || credit.getStatus() == LessonCreditStatus.BOOKED
                || credit.getStatus() == LessonCreditStatus.MAKEUP_DUE
                || credit.getStatus() == LessonCreditStatus.MAKEUP_SCHEDULED;
    }

    private String packageStatus(
            StudentSessionPackage sessionPackage,
            int remaining,
            List<LessonCredit> credits
    ) {
        boolean hasScheduledMakeup = credits.stream().anyMatch(credit ->
                credit.getStatus() == LessonCreditStatus.MAKEUP_SCHEDULED
                        && credit.getCurrentSession() != null
                        && !credit.getCurrentSession().getDate().isBefore(BillingDates.today())
        );
        if (hasScheduledMakeup && sessionPackage.getInvoice().getStatus() != InvoiceStatus.CANCELLED) {
            return "ACTIVE";
        }
        return packageStatus(sessionPackage, remaining);
    }

    private void assertRecordBelongsToPackage(StudentSessionPackage sessionPackage, AttendanceRecord record) {
        boolean sameStudent = record.getStudent().getId().equals(sessionPackage.getStudent().getId());
        boolean sameOffering = record.getSession().getCourseOffering() != null
                && record.getSession().getCourseOffering().getId().equals(sessionPackage.getCourseOffering().getId());
        boolean inRange = !record.getSession().getDate().isBefore(sessionPackage.getServiceFrom())
                && !record.getSession().getDate().isAfter(sessionPackage.getServiceTo());
        if (!sameStudent || !sameOffering || !inRange) {
            throw new ResponseStatusException(BAD_REQUEST, "Attendance record is outside this session package.");
        }
    }
}
