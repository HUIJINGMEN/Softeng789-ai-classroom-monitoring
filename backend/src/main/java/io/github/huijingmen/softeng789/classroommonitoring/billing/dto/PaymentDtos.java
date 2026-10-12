package io.github.huijingmen.softeng789.classroommonitoring.billing.dto;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AbsenceBillingPolicy;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AttendanceBillingDecision;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentMethod;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.FeeRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LearningEntitlementStatus;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;

public final class PaymentDtos {
    private PaymentDtos() {
    }

    public record CreateInvoiceRequest(
            @NotEmpty @Size(max = 100) List<UUID> studentIds,
            @NotBlank @Size(max = 160) String title,
            @Size(max = 2000) String note,
            @NotNull @FutureOrPresent LocalDate dueDate,
            @NotNull @Size(max = 20) List<@Valid LineItemRequest> lineItems,
            @Size(max = 20) List<@Valid CoursePurchaseRequest> coursePurchases,
            @Valid LearningEntitlementRequest entitlement
    ) {
        public CreateInvoiceRequest(
                List<UUID> studentIds,
                String title,
                String note,
                LocalDate dueDate,
                List<LineItemRequest> lineItems,
                LearningEntitlementRequest entitlement
        ) {
            this(studentIds, title, note, dueDate, lineItems, List.of(), entitlement);
        }

        public List<CoursePurchaseRequest> purchases() {
            return coursePurchases == null ? List.of() : coursePurchases;
        }
    }

    public record CoursePurchaseRequest(
            @NotBlank @Size(max = 180) String description,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotNull @Valid LearningEntitlementRequest entitlement
    ) {
    }

    public record LearningEntitlementRequest(
            @NotNull UUID courseOfferingId,
            @NotNull CoursePurchaseMode purchaseMode,
            LocalDate validFrom,
            LocalDate validTo,
            @jakarta.validation.constraints.Min(1)
            @jakarta.validation.constraints.Max(500) Integer includedSessions,
            AbsenceBillingPolicy absencePolicy,
            UUID classroomSessionId
    ) {
    }

    public record LearningEntitlementResponse(
            UUID id,
            UUID courseOfferingId,
            String courseCode,
            String academicTerm,
            CoursePurchaseMode purchaseMode,
            LearningEntitlementStatus status,
            LocalDate validFrom,
            LocalDate validTo,
            Integer sessionAllowance,
            UUID classroomSessionId,
            LocalDate classroomSessionDate
    ) {
    }

    public record CoursePurchaseResponse(
            UUID lineItemId,
            LearningEntitlementResponse entitlement,
            SessionPackageUsageResponse sessionPackage
    ) {
    }

    public record LineItemRequest(
            @NotBlank @Size(max = 180) String description,
            @NotNull LineItemType type,
            @NotNull @DecimalMin("0.01") BigDecimal amount
    ) {
    }

    public record LineItemResponse(
            UUID id,
            String description,
            LineItemType type,
            BigDecimal amount
    ) {
    }

    public record TransactionResponse(
            UUID id,
            BigDecimal amount,
            PaymentStatus status,
            String provider,
            String reference,
            Instant occurredAt
    ) {
    }

    public record BankAccountResponse(
            UUID id,
            String accountName,
            String bankName,
            String accountNumber,
            String paymentReference,
            String instructions,
            Instant updatedAt
    ) {
    }

    public record UpdateBankAccountRequest(
            @NotBlank @Size(max = 120) String accountName,
            @NotBlank @Size(max = 120) String bankName,
            @NotBlank @Size(max = 80) String accountNumber,
            @Size(max = 120) String paymentReference,
            @Size(max = 2000) String instructions
    ) {
    }

    public record ManualPaymentResponse(
            UUID id,
            UUID invoiceId,
            UUID studentId,
            String studentName,
            String studentNumber,
            String invoiceTitle,
            String currency,
            BigDecimal amount,
            ManualPaymentMethod method,
            ManualPaymentStatus status,
            String studentNote,
            String receiptFileName,
            String receiptContentType,
            long receiptFileSize,
            Instant submittedAt,
            String reviewNote,
            Instant reviewedAt
    ) {
    }

    public record InvoiceResponse(
            UUID id,
            String studentName,
            String studentNumber,
            String invoiceNumber,
            String title,
            String note,
            LocalDate dueDate,
            String currency,
            InvoiceStatus status,
            BigDecimal charges,
            BigDecimal credits,
            BigDecimal payments,
            BigDecimal balance,
            List<LineItemResponse> lineItems,
            List<TransactionResponse> transactions,
            List<ManualPaymentResponse> manualPayments,
            LearningEntitlementResponse entitlement,
            SessionPackageUsageResponse sessionPackage,
            List<CoursePurchaseResponse> coursePurchases,
            Instant createdAt,
            Instant messageDraftSavedAt,
            Instant messageReviewedAt,
            Instant lastEmailedAt
    ) {
    }

    public record SessionUsageEntryResponse(
            UUID attendanceRecordId,
            UUID sessionId,
            LocalDate sessionDate,
            AttendanceStatus attendanceStatus,
            boolean consumesSession,
            AttendanceBillingDecision overrideDecision,
            String overrideReason,
            UUID lessonCreditId,
            LessonCreditStatus creditStatus,
            UUID originalSessionId,
            LocalDate originalSessionDate,
            UUID makeupSessionId,
            LocalDate makeupSessionDate
    ) {
    }

    public record SessionPackageUsageResponse(
            UUID id,
            UUID entitlementId,
            UUID courseOfferingId,
            String courseCode,
            String academicTerm,
            int purchasedSessions,
            int usedSessions,
            int remainingSessions,
            int attendedSessions,
            int chargeableAbsences,
            int waivedAbsences,
            int unrecordedSessions,
            LocalDate serviceFrom,
            LocalDate serviceTo,
            AbsenceBillingPolicy absencePolicy,
            String status,
            List<SessionUsageEntryResponse> sessions
    ) {
    }

    public record UpdateAttendanceBillingRequest(
            @NotNull AttendanceBillingDecision decision,
            @NotBlank @Size(max = 500) String reason
    ) {
    }

    public record StudentStatementResponse(
            UUID studentId,
            String studentName,
            String studentNumber,
            String currency,
            BigDecimal totalCharges,
            BigDecimal totalCredits,
            BigDecimal totalPayments,
            BigDecimal amountDue,
            LocalDate nextDueDate,
            boolean demoMode,
            BankAccountResponse bankAccount,
            List<InvoiceResponse> invoices
    ) {
    }

    public record AdminPaymentRowResponse(
            UUID invoiceId,
            UUID studentId,
            String studentName,
            String studentNumber,
            String title,
            LocalDate dueDate,
            String currency,
            BigDecimal total,
            BigDecimal paid,
            BigDecimal balance,
            InvoiceStatus status
    ) {
    }

    public record AdminPaymentSummaryResponse(
            BigDecimal outstanding,
            BigDecimal collected,
            long draftCount,
            long overdueCount,
            long openCount,
            String currency
    ) {
    }

    public record AdminPaymentsResponse(
            AdminPaymentSummaryResponse summary,
            PageResponse<AdminPaymentRowResponse> page
    ) {
    }

    public record CreateInvoicesResponse(List<InvoiceResponse> invoices) {
    }

    public record CheckoutResponse(
            InvoiceResponse invoice,
            String message,
            boolean demoMode
    ) {
    }

    public record InvoiceMessageDraftResponse(
            String message,
            String tone,
            String provider
    ) {
    }

    public record DeliverInvoiceRequest(
            @NotBlank @Size(max = 2000) String message,
            @Size(max = 100) String deliveryKey
    ) {
    }

    public record SaveInvoiceMessageRequest(
            @NotBlank @Size(max = 2000) String message,
            boolean reviewed
    ) {
    }

    public record SavedInvoiceMessageResponse(
            String message,
            Instant savedAt,
            Instant reviewedAt
    ) {
    }

    public record InvoiceDeliveryResponse(
            String status,
            String message,
            Instant emailedAt
    ) {
    }

    public record AdminManualPaymentsResponse(
            long pendingCount,
            PageResponse<ManualPaymentResponse> page
    ) {
    }

    public record ReviewManualPaymentRequest(
            @NotNull ManualPaymentStatus decision,
            @Size(max = 1000) String note
    ) {
    }

    public record FeeRequestResponse(
            UUID id,
            UUID studentId,
            String studentName,
            String studentNumber,
            String title,
            String requestDetails,
            FeeRequestStatus status,
            String evidenceFileName,
            String evidenceContentType,
            Long evidenceFileSize,
            UUID invoiceId,
            String reviewNote,
            Instant submittedAt,
            Instant reviewedAt
    ) {
    }

    public record AdminFeeRequestsResponse(long submittedCount, PageResponse<FeeRequestResponse> page) {
    }

    public record QuoteFeeRequestRequest(
            @NotBlank @Size(max = 160) String invoiceTitle,
            @Size(max = 2000) String note,
            @NotNull @FutureOrPresent LocalDate dueDate,
            @NotEmpty @Size(max = 20) List<@Valid LineItemRequest> lineItems
    ) {
    }

    public record DeclineFeeRequestRequest(@NotBlank @Size(max = 1000) String note) {
    }
}
