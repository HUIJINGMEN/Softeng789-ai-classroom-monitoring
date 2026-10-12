package io.github.huijingmen.softeng789.classroommonitoring.billing.dto;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AbsenceBillingPolicy;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CoursePurchaseRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LineItemRequest;
import jakarta.validation.Valid;
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

public final class InvoiceSuggestionDtos {
    private InvoiceSuggestionDtos() {
    }

    public enum ChargeSuggestionStatus {
        READY,
        NEEDS_PRICE,
        OPTIONAL_RENEWAL,
        ALREADY_BILLED,
        UNAVAILABLE
    }

    public record ChargeSuggestionPreviewRequest(
            @NotEmpty @Size(max = 100) List<UUID> studentIds,
            UUID preferredCourseOfferingId,
            LocalDate billingDate
    ) {
    }

    public record CourseChargeSuggestionResponse(
            UUID courseOfferingId,
            String courseCode,
            String academicTerm,
            CoursePurchaseMode purchaseMode,
            String description,
            BigDecimal defaultPrice,
            String currency,
            ChargeSuggestionStatus status,
            String statusDetail,
            boolean selectedByDefault,
            boolean preferredCourse,
            LocalDate validFrom,
            LocalDate validTo,
            Integer includedSessions,
            AbsenceBillingPolicy absencePolicy,
            List<ChargeableSessionResponse> availableSessions,
            UUID classroomSessionId,
            LocalDate classroomSessionDate,
            Instant classroomSessionStartTime,
            Instant classroomSessionEndTime,
            String previousInvoiceNumber
    ) {
    }

    public record ChargeableSessionResponse(
            UUID id,
            LocalDate date,
            Instant startTime,
            Instant endTime
    ) {
    }

    public record StudentChargeSuggestionsResponse(
            UUID studentId,
            String studentName,
            String studentNumber,
            List<CourseChargeSuggestionResponse> courses
    ) {
    }

    public record ChargeSuggestionPreviewResponse(
            LocalDate billingDate,
            List<StudentChargeSuggestionsResponse> students
    ) {
    }

    public record StudentInvoiceDraftRequest(
            @NotNull UUID studentId,
            @NotBlank @Size(max = 160) String title,
            @Size(max = 2000) String note,
            @NotNull @FutureOrPresent LocalDate dueDate,
            @NotNull @Size(max = 20) List<@Valid LineItemRequest> lineItems,
            @NotNull @Size(max = 20) List<@Valid CoursePurchaseRequest> coursePurchases
    ) {
    }

    public record CreateStudentInvoiceBatchRequest(
            @NotEmpty @Size(max = 100) List<@Valid StudentInvoiceDraftRequest> invoices
    ) {
    }

    public record CreateStudentInvoiceBatchResponse(List<InvoiceResponse> invoices) {
    }
}
