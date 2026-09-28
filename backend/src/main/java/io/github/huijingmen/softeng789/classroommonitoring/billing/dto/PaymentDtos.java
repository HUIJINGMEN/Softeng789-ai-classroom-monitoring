package io.github.huijingmen.softeng789.classroommonitoring.billing.dto;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus;
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

public final class PaymentDtos {
    private PaymentDtos() {
    }

    public record CreateInvoiceRequest(
            @NotEmpty @Size(max = 100) List<UUID> studentIds,
            @NotBlank @Size(max = 160) String title,
            @Size(max = 2000) String note,
            @NotNull @FutureOrPresent LocalDate dueDate,
            @NotEmpty @Size(max = 20) List<@Valid LineItemRequest> lineItems
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

    public record InvoiceResponse(
            UUID id,
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
            Instant createdAt
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
}
