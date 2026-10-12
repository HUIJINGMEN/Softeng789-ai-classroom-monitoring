package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentSubmission;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.InvoiceAccountResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.TransferClassOptionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SessionPackageUsageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.ManualPaymentSubmissionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Builds the complete account read model without owning any account mutations. */
@Service
public class BillingAccountQueryService {
    private final ManualPaymentSubmissionRepository manualPaymentRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final SessionPackageService sessionPackageService;
    private final BillingAccountActivityService activityService;

    public BillingAccountQueryService(
            ManualPaymentSubmissionRepository manualPaymentRepository,
            CourseEnrollmentRepository enrollmentRepository,
            SessionPackageService sessionPackageService,
            BillingAccountActivityService activityService
    ) {
        this.manualPaymentRepository = manualPaymentRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.sessionPackageService = sessionPackageService;
        this.activityService = activityService;
    }

    // SessionPackageService refreshes lesson-credit lifecycle state before mapping
    // the account. A read-only transaction would reject its SELECT FOR UPDATE.
    @Transactional
    public InvoiceAccountResponse response(StudentInvoice invoice) {
        List<SessionPackageUsageResponse> packages = sessionPackageService
                .summarizeAllForInvoices(List.of(invoice.getId()))
                .getOrDefault(invoice.getId(), List.of());
        List<ManualPaymentSubmission> manualPayments = manualPaymentRepository
                .findByInvoice_IdOrderBySubmittedAtAsc(invoice.getId());
        return new InvoiceAccountResponse(
                PaymentResponseMapper.toInvoice(invoice, manualPayments, packages),
                activityService.activities(invoice),
                activityService.timeline(invoice, manualPayments),
                transferOptions(invoice, packages)
        );
    }

    private List<TransferClassOptionResponse> transferOptions(
            StudentInvoice invoice,
            List<SessionPackageUsageResponse> packages
    ) {
        if (packages.isEmpty()) return List.of();
        var currentOfferingIds = packages.stream()
                .map(SessionPackageUsageResponse::courseOfferingId)
                .collect(java.util.stream.Collectors.toSet());
        return enrollmentRepository.findByStudent_IdAndStatus(invoice.getStudent().getId(), EnrollmentStatus.ACTIVE)
                .stream()
                .map(enrollment -> enrollment.getCourseOffering())
                .filter(offering -> !currentOfferingIds.contains(offering.getId()))
                .filter(offering -> "ACTIVE".equals(offering.getStatus()))
                .filter(offering -> offering.getPurchaseMode() == CoursePurchaseMode.LESSON_PACKAGE)
                .map(offering -> new TransferClassOptionResponse(
                        offering.getId(), offering.getCourse().getCode(), offering.getAcademicTerm()
                ))
                .sorted(Comparator.comparing(TransferClassOptionResponse::courseCode)
                        .thenComparing(TransferClassOptionResponse::academicTerm))
                .toList();
    }
}
