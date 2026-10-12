package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AccountActivityType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LearningEntitlementStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.SessionPackageAction;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.SessionPackageStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentSessionPackage;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.ManageSessionPackageRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.SessionPackageOperationResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SessionPackageUsageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentSessionPackageRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/** Executes package lifecycle commands under a row lock and records one audit event per command. */
@Service
public class SessionPackageLifecycleService {
    private final StudentSessionPackageRepository packageRepository;
    private final TeacherRepository teacherRepository;
    private final CourseOfferingRepository offeringRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final SessionPackageService sessionPackageService;
    private final LessonCreditService lessonCreditService;
    private final BillingAccountActivityService activityService;

    public SessionPackageLifecycleService(
            StudentSessionPackageRepository packageRepository,
            TeacherRepository teacherRepository,
            CourseOfferingRepository offeringRepository,
            CourseEnrollmentRepository enrollmentRepository,
            SessionPackageService sessionPackageService,
            LessonCreditService lessonCreditService,
            BillingAccountActivityService activityService
    ) {
        this.packageRepository = packageRepository;
        this.teacherRepository = teacherRepository;
        this.offeringRepository = offeringRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.sessionPackageService = sessionPackageService;
        this.lessonCreditService = lessonCreditService;
        this.activityService = activityService;
    }

    @Transactional
    public SessionPackageOperationResponse manage(
            UUID adminId,
            UUID packageId,
            ManageSessionPackageRequest request
    ) {
        StudentSessionPackage sessionPackage = packageRepository.findByIdForUpdate(packageId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Session package not found."));
        Teacher admin = requireAdmin(adminId);
        String reason = request.reason().trim();
        LifecycleChange change = apply(request, sessionPackage, admin, reason);

        StudentSessionPackage saved = packageRepository.saveAndFlush(sessionPackage);
        reconcileCredits(request.action(), saved, admin, reason);
        activityService.record(
                saved.getStudent(), saved.getInvoice(), saved, change.activityType(), null,
                change.fromValue(), change.toValue(), reason, admin
        );
        SessionPackageUsageResponse usage = sessionPackageService.summarizePackage(saved.getId());
        return new SessionPackageOperationResponse(usage, activityService.activities(saved.getInvoice()));
    }

    private LifecycleChange apply(
            ManageSessionPackageRequest request,
            StudentSessionPackage sessionPackage,
            Teacher admin,
            String reason
    ) {
        return switch (request.action()) {
            case PAUSE -> pause(sessionPackage, admin, reason);
            case RESUME -> resume(sessionPackage, reason);
            case EXTEND -> extend(sessionPackage, request, reason);
            case TRANSFER -> transfer(sessionPackage, request, admin, reason);
            case CANCEL -> cancel(sessionPackage, admin, reason);
        };
    }

    private LifecycleChange pause(StudentSessionPackage sessionPackage, Teacher admin, String reason) {
        requireStatus(sessionPackage, SessionPackageStatus.ACTIVE, "Only an active package can be paused.");
        sessionPackage.setStatus(SessionPackageStatus.PAUSED);
        sessionPackage.setPausedAt(Instant.now());
        sessionPackage.setLifecycleNote(reason);
        lessonCreditService.pausePackage(sessionPackage, admin, reason);
        return new LifecycleChange(AccountActivityType.PACKAGE_PAUSED, "ACTIVE", "PAUSED");
    }

    private LifecycleChange resume(StudentSessionPackage sessionPackage, String reason) {
        requireStatus(sessionPackage, SessionPackageStatus.PAUSED, "Only a paused package can be resumed.");
        sessionPackage.setStatus(SessionPackageStatus.ACTIVE);
        sessionPackage.setPausedAt(null);
        sessionPackage.setLifecycleNote(reason);
        return new LifecycleChange(AccountActivityType.PACKAGE_RESUMED, "PAUSED", "ACTIVE");
    }

    private LifecycleChange extend(
            StudentSessionPackage sessionPackage,
            ManageSessionPackageRequest request,
            String reason
    ) {
        if (request.serviceTo() == null || !request.serviceTo().isAfter(sessionPackage.getServiceTo())) {
            throw new ResponseStatusException(BAD_REQUEST, "Choose a new end date after the current end date.");
        }
        if (sessionPackage.getStatus() == SessionPackageStatus.CANCELLED) {
            throw new ResponseStatusException(BAD_REQUEST, "A cancelled package cannot be extended.");
        }
        String previousEndDate = sessionPackage.getServiceTo().toString();
        sessionPackage.setServiceTo(request.serviceTo());
        if (sessionPackage.getEntitlement() != null) {
            sessionPackage.getEntitlement().setValidTo(request.serviceTo());
        }
        sessionPackage.setLifecycleNote(reason);
        return new LifecycleChange(
                AccountActivityType.PACKAGE_EXTENDED,
                previousEndDate,
                request.serviceTo().toString()
        );
    }

    private LifecycleChange transfer(
            StudentSessionPackage sessionPackage,
            ManageSessionPackageRequest request,
            Teacher admin,
            String reason
    ) {
        if (request.targetCourseOfferingId() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Choose the class that will receive the package.");
        }
        if (sessionPackage.getStatus() == SessionPackageStatus.CANCELLED
                || sessionPackage.getStatus() == SessionPackageStatus.PENDING_PAYMENT) {
            throw new ResponseStatusException(BAD_REQUEST, "Only a paid, open package can be transferred.");
        }
        CourseOffering target = offeringRepository.findById(request.targetCourseOfferingId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Target class not found."));
        if (target.getId().equals(sessionPackage.getCourseOffering().getId())) {
            throw new ResponseStatusException(BAD_REQUEST, "Choose a different class.");
        }
        if (!"ACTIVE".equals(target.getStatus()) || target.getPurchaseMode() != CoursePurchaseMode.LESSON_PACKAGE) {
            throw new ResponseStatusException(BAD_REQUEST, "The target must be an active lesson-package class.");
        }
        if (!enrollmentRepository.existsByStudent_IdAndCourseOffering_IdAndStatus(
                sessionPackage.getStudent().getId(), target.getId(), EnrollmentStatus.ACTIVE)) {
            throw new ResponseStatusException(BAD_REQUEST, "The student must be actively enrolled in the target class.");
        }
        CourseOffering source = sessionPackage.getCourseOffering();
        lessonCreditService.preparePackageTransfer(sessionPackage, admin, reason);
        sessionPackage.setCourseOffering(target);
        sessionPackage.setLifecycleNote(reason);
        return new LifecycleChange(
                AccountActivityType.PACKAGE_TRANSFERRED,
                label(source),
                label(target)
        );
    }

    private LifecycleChange cancel(StudentSessionPackage sessionPackage, Teacher admin, String reason) {
        if (sessionPackage.getStatus() == SessionPackageStatus.CANCELLED) {
            throw new ResponseStatusException(BAD_REQUEST, "This package is already cancelled.");
        }
        String previousStatus = sessionPackage.getStatus().name();
        sessionPackage.setStatus(SessionPackageStatus.CANCELLED);
        sessionPackage.setCancelledAt(Instant.now());
        sessionPackage.setLifecycleNote(reason);
        if (sessionPackage.getEntitlement() != null) {
            sessionPackage.getEntitlement().setStatus(LearningEntitlementStatus.CANCELLED);
        }
        lessonCreditService.cancelPackage(sessionPackage, admin, reason);
        return new LifecycleChange(AccountActivityType.PACKAGE_CANCELLED, previousStatus, "CANCELLED");
    }

    private void reconcileCredits(
            SessionPackageAction action,
            StudentSessionPackage sessionPackage,
            Teacher admin,
            String reason
    ) {
        if (action == SessionPackageAction.RESUME || action == SessionPackageAction.TRANSFER) {
            lessonCreditService.reconcilePackage(sessionPackage);
        } else if (action == SessionPackageAction.EXTEND) {
            lessonCreditService.extendPackage(sessionPackage, admin, reason);
        }
    }

    private Teacher requireAdmin(UUID adminId) {
        return teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));
    }

    private void requireStatus(StudentSessionPackage sessionPackage, SessionPackageStatus expected, String message) {
        if (sessionPackage.getStatus() != expected) throw new ResponseStatusException(BAD_REQUEST, message);
    }

    private String label(CourseOffering offering) {
        return offering.getCourse().getCode() + " · " + offering.getAcademicTerm();
    }

    private record LifecycleChange(AccountActivityType activityType, String fromValue, String toValue) {
    }
}
