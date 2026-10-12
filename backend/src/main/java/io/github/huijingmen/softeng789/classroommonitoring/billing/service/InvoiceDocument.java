package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SessionPackageUsageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LearningEntitlementResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CoursePurchaseResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Immutable snapshot used by PDF and email adapters after database work has completed. */
public record InvoiceDocument(
        UUID invoiceId,
        String invoiceNumber,
        String title,
        String studentName,
        String studentNumber,
        String studentEmail,
        LocalDate issuedDate,
        LocalDate dueDate,
        String currency,
        List<Item> items,
        BigDecimal charges,
        BigDecimal credits,
        BigDecimal payments,
        BigDecimal balance,
        LearningEntitlementResponse entitlement,
        SessionPackageUsageResponse sessionPackage,
        List<CoursePurchaseResponse> coursePurchases,
        String note,
        Instant lastEmailedAt
) {
    public InvoiceDocument(
            UUID invoiceId,
            String invoiceNumber,
            String title,
            String studentName,
            String studentNumber,
            String studentEmail,
            LocalDate issuedDate,
            LocalDate dueDate,
            String currency,
            List<Item> items,
            BigDecimal charges,
            BigDecimal credits,
            BigDecimal payments,
            BigDecimal balance,
            LearningEntitlementResponse entitlement,
            SessionPackageUsageResponse sessionPackage,
            String note,
            Instant lastEmailedAt
    ) {
        this(
                invoiceId, invoiceNumber, title, studentName, studentNumber, studentEmail,
                issuedDate, dueDate, currency, items, charges, credits, payments, balance,
                entitlement, sessionPackage, List.of(), note, lastEmailedAt
        );
    }

    public record Item(String description, LineItemType type, BigDecimal amount) {
    }

    public String fileName() {
        return "ClassLens-" + invoiceNumber + ".pdf";
    }
}
