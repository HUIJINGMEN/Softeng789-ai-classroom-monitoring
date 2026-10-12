package io.github.huijingmen.softeng789.classroommonitoring.billing.dto;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AccountActivityType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AccountAdjustmentType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.SessionPackageAction;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SessionPackageUsageResponse;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class BillingOperationsDtos {
    private BillingOperationsDtos() {
    }

    public record AccountAdjustmentRequest(
            @NotNull AccountAdjustmentType type,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotBlank @Size(max = 500) String reason,
            @Size(max = 100) String externalReference
    ) {
    }

    public record ManageSessionPackageRequest(
            @NotNull SessionPackageAction action,
            LocalDate serviceTo,
            UUID targetCourseOfferingId,
            @NotBlank @Size(max = 500) String reason
    ) {
    }

    public record AccountActivityResponse(
            UUID id,
            AccountActivityType type,
            BigDecimal amount,
            String fromValue,
            String toValue,
            String reason,
            String externalReference,
            String actorName,
            Instant createdAt
    ) {
    }

    public record AccountTimelineEventResponse(
            String id,
            String type,
            String title,
            String detail,
            BigDecimal amount,
            String reference,
            String actorName,
            Instant occurredAt
    ) {
    }

    public record TransferClassOptionResponse(
            UUID courseOfferingId,
            String courseCode,
            String academicTerm
    ) {
    }

    public record InvoiceAccountResponse(
            InvoiceResponse invoice,
            List<AccountActivityResponse> activities,
            List<AccountTimelineEventResponse> timeline,
            List<TransferClassOptionResponse> transferOptions
    ) {
    }

    public record SessionPackageOperationResponse(
            SessionPackageUsageResponse sessionPackage,
            List<AccountActivityResponse> activities
    ) {
    }

    public record OperationsFinancialResponse(
            String currency,
            BigDecimal grossReceived,
            BigDecimal refunded,
            BigDecimal netReceived,
            BigDecimal outstanding,
            BigDecimal overdue
    ) {
    }

    public record OperationsAlertResponse(
            String type,
            String severity,
            String title,
            String detail,
            UUID studentId,
            String studentName,
            UUID invoiceId,
            UUID sessionPackageId,
            UUID courseOfferingId,
            LocalDate actionDate,
            BigDecimal amount,
            Integer remainingLessons
    ) {
    }

    public record CourseOperationsResponse(
            UUID courseOfferingId,
            String courseCode,
            String academicTerm,
            long students,
            BigDecimal netReceived,
            BigDecimal outstanding,
            int purchasedLessons,
            int usedLessons,
            int utilizationPercent
    ) {
    }

    public record OperationsDashboardResponse(
            OperationsFinancialResponse financial,
            List<OperationsAlertResponse> alerts,
            List<CourseOperationsResponse> courses,
            LocalDate from,
            LocalDate to,
            Instant generatedAt
    ) {
    }
}
