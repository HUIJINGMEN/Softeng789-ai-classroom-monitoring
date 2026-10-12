package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LearningEntitlementStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentLearningEntitlement;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LearningEntitlementRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentLearningEntitlementRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class LearningEntitlementService {
    private static final EnumSet<LearningEntitlementStatus> BILLED_STATUSES = EnumSet.of(
            LearningEntitlementStatus.PENDING_PAYMENT,
            LearningEntitlementStatus.ACTIVE,
            LearningEntitlementStatus.COMPLETED,
            LearningEntitlementStatus.EXPIRED
    );

    private final StudentLearningEntitlementRepository entitlementRepository;
    private final CourseOfferingRepository offeringRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final ClassroomSessionRepository sessionRepository;

    public LearningEntitlementService(
            StudentLearningEntitlementRepository entitlementRepository,
            CourseOfferingRepository offeringRepository,
            CourseEnrollmentRepository enrollmentRepository,
            ClassroomSessionRepository sessionRepository
    ) {
        this.entitlementRepository = entitlementRepository;
        this.offeringRepository = offeringRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.sessionRepository = sessionRepository;
    }

    @Transactional
    public Map<UUID, StudentLearningEntitlement> createForInvoices(
            List<StudentInvoice> invoices,
            LearningEntitlementRequest request,
            int lineItemPosition
    ) {
        if (request == null) return Map.of();
        CourseOffering offering = offeringRepository.findById(request.courseOfferingId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
        if (offering.getPurchaseMode() != request.purchaseMode()) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "This class is configured for " + offering.getPurchaseMode().name().toLowerCase().replace('_', ' ')
                            + ", not the requested purchase type.");
        }
        validateRequest(offering, request);
        ClassroomSession selectedSession = selectedSession(offering, request);
        List<ClassroomSession> scheduled = request.purchaseMode() == CoursePurchaseMode.COURSE_ENROLMENT
                ? scheduledSessions(offering.getId()) : List.of();

        Map<UUID, StudentLearningEntitlement> created = new LinkedHashMap<>();
        for (StudentInvoice invoice : invoices) {
            requireActiveEnrollment(invoice, offering);
            preventDuplicate(invoice, offering, request, selectedSession);
            StudentLearningEntitlement entitlement = new StudentLearningEntitlement();
            entitlement.setStudent(invoice.getStudent());
            entitlement.setCourseOffering(offering);
            entitlement.setClassroomSession(selectedSession);
            entitlement.setPurchaseMode(request.purchaseMode());
            entitlement.setStatus(invoice.getStatus() == InvoiceStatus.PAID
                    ? LearningEntitlementStatus.ACTIVE
                    : LearningEntitlementStatus.PENDING_PAYMENT);
            entitlement.setValidFrom(resolveFrom(request, scheduled, selectedSession));
            entitlement.setValidTo(resolveTo(request, scheduled, selectedSession));
            entitlement.setSessionAllowance(resolveAllowance(offering, request));
            entitlement.setLineItem(lineItemPosition < 0 ? null : invoice.getLineItems().get(lineItemPosition));
            invoice.addEntitlement(entitlement);
            StudentLearningEntitlement saved = entitlementRepository.save(entitlement);
            created.put(invoice.getId(), saved);
        }
        return created;
    }

    @Transactional
    public Map<UUID, StudentLearningEntitlement> createForInvoices(
            List<StudentInvoice> invoices,
            LearningEntitlementRequest request
    ) {
        return createForInvoices(invoices, request, -1);
    }

    @Transactional
    public void activateForInvoice(StudentInvoice invoice) {
        if (invoice.getStatus() != InvoiceStatus.PAID) return;
        invoice.getEntitlements().stream()
                .filter(entitlement -> entitlement.getStatus() == LearningEntitlementStatus.PENDING_PAYMENT)
                .forEach(entitlement -> entitlement.setStatus(LearningEntitlementStatus.ACTIVE));
        entitlementRepository.saveAll(invoice.getEntitlements());
    }

    private void validateRequest(CourseOffering offering, LearningEntitlementRequest request) {
        if (request.validFrom() != null && request.validTo() != null
                && request.validTo().isBefore(request.validFrom())) {
            throw new ResponseStatusException(BAD_REQUEST, "Access end date must be on or after its start date.");
        }
        if (request.purchaseMode() == CoursePurchaseMode.LESSON_PACKAGE) {
            if (request.includedSessions() == null || request.absencePolicy() == null
                    || request.validFrom() == null || request.validTo() == null) {
                throw new ResponseStatusException(BAD_REQUEST,
                        "Lesson packages require a lesson count, validity dates and an absence policy.");
            }
        }
        if (request.purchaseMode() == CoursePurchaseMode.MEMBERSHIP
                && (request.validFrom() == null || request.validTo() == null)) {
            throw new ResponseStatusException(BAD_REQUEST, "Membership purchases require a start and end date.");
        }
        if (request.purchaseMode() == CoursePurchaseMode.PAY_PER_LESSON
                && request.classroomSessionId() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Choose the lesson being charged.");
        }
        if (offering.getStatus().equals("ARCHIVED")) {
            throw new ResponseStatusException(BAD_REQUEST, "Archived classes cannot receive new purchases.");
        }
    }

    private ClassroomSession selectedSession(CourseOffering offering, LearningEntitlementRequest request) {
        if (request.classroomSessionId() == null) return null;
        ClassroomSession session = sessionRepository.findById(request.classroomSessionId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Lesson not found."));
        if (session.getCourseOffering() == null
                || !session.getCourseOffering().getId().equals(offering.getId())
                || session.getStatus() == SessionStatus.CANCELLED) {
            throw new ResponseStatusException(BAD_REQUEST, "Choose an available lesson from this class.");
        }
        return session;
    }

    private List<ClassroomSession> scheduledSessions(UUID offeringId) {
        return sessionRepository.findByCourseOffering_IdInOrderByDateAscStartTimeAsc(List.of(offeringId)).stream()
                .filter(session -> session.getStatus() != SessionStatus.CANCELLED)
                .toList();
    }

    private void requireActiveEnrollment(StudentInvoice invoice, CourseOffering offering) {
        if (!enrollmentRepository.existsByStudent_IdAndCourseOffering_IdAndStatus(
                invoice.getStudent().getId(), offering.getId(), EnrollmentStatus.ACTIVE)) {
            throw new ResponseStatusException(BAD_REQUEST,
                    invoice.getStudent().getFullName() + " is not actively enrolled in the selected class.");
        }
    }

    private void preventDuplicate(
            StudentInvoice invoice,
            CourseOffering offering,
            LearningEntitlementRequest request,
            ClassroomSession selectedSession
    ) {
        UUID studentId = invoice.getStudent().getId();
        if (request.purchaseMode() == CoursePurchaseMode.COURSE_ENROLMENT
                && entitlementRepository.existsByStudent_IdAndCourseOffering_IdAndPurchaseModeAndStatusIn(
                        studentId, offering.getId(), request.purchaseMode(), BILLED_STATUSES)) {
            throw new ResponseStatusException(CONFLICT,
                    invoice.getStudent().getFullName() + " already has a current enrolment purchase for this class.");
        }
        if (selectedSession != null
                && entitlementRepository.existsByStudent_IdAndClassroomSession_IdAndStatusIn(
                        studentId, selectedSession.getId(), BILLED_STATUSES)) {
            throw new ResponseStatusException(CONFLICT,
                    invoice.getStudent().getFullName() + " has already been charged for this lesson.");
        }
        if (request.purchaseMode() == CoursePurchaseMode.MEMBERSHIP
                && entitlementRepository
                    .existsByStudent_IdAndCourseOffering_IdAndPurchaseModeAndValidFromLessThanEqualAndValidToGreaterThanEqualAndStatusIn(
                            studentId,
                            offering.getId(),
                            request.purchaseMode(),
                            request.validTo(),
                            request.validFrom(),
                            BILLED_STATUSES
                    )) {
            throw new ResponseStatusException(CONFLICT,
                    invoice.getStudent().getFullName() + " already has a membership covering this period.");
        }
    }

    private LocalDate resolveFrom(
            LearningEntitlementRequest request,
            List<ClassroomSession> scheduled,
            ClassroomSession selectedSession
    ) {
        if (selectedSession != null) return selectedSession.getDate();
        if (request.purchaseMode() == CoursePurchaseMode.COURSE_ENROLMENT) {
            return scheduled.isEmpty() ? null : scheduled.getFirst().getDate();
        }
        return request.validFrom();
    }

    private LocalDate resolveTo(
            LearningEntitlementRequest request,
            List<ClassroomSession> scheduled,
            ClassroomSession selectedSession
    ) {
        if (selectedSession != null) return selectedSession.getDate();
        if (request.purchaseMode() == CoursePurchaseMode.COURSE_ENROLMENT) {
            return scheduled.isEmpty() ? null : scheduled.getLast().getDate();
        }
        return request.validTo();
    }

    private Integer resolveAllowance(CourseOffering offering, LearningEntitlementRequest request) {
        return switch (request.purchaseMode()) {
            case COURSE_ENROLMENT -> null;
            case LESSON_PACKAGE -> request.includedSessions();
            case MEMBERSHIP -> offering.getSessionsPerPeriod();
            case PAY_PER_LESSON -> 1;
        };
    }
}
