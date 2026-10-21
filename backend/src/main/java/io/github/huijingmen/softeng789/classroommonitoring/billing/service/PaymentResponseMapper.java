package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentMethod;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentSubmission;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentBankAccount;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.BankAccountResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.ManualPaymentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LineItemResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LearningEntitlementResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CoursePurchaseResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.StudentStatementResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.SessionPackageUsageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.TransactionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentLearningEntitlement;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.balance;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.charges;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.credits;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.payments;

final class PaymentResponseMapper {
    private PaymentResponseMapper() {
    }

    static StudentStatementResponse toStatement(
            Student student,
            List<StudentInvoice> invoices,
            String currency,
            PaymentBankAccount bankAccount,
            Map<UUID, List<ManualPaymentSubmission>> paymentsByInvoice,
            Map<UUID, List<SessionPackageUsageResponse>> packagesByInvoice,
            List<StudentPaymentMethod> paymentMethods
    ) {
        BigDecimal totalCharges = sum(invoices, InvoiceAmounts::charges);
        BigDecimal totalCredits = sum(invoices, InvoiceAmounts::credits);
        BigDecimal totalPayments = sum(invoices, InvoiceAmounts::payments);
        BigDecimal amountDue = invoices.stream()
                .filter(invoice -> InvoiceStatusPolicy.current(invoice).isOpen())
                .map(InvoiceAmounts::balance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        LocalDate nextDueDate = invoices.stream()
                .filter(invoice -> InvoiceStatusPolicy.current(invoice).isOpen())
                .map(StudentInvoice::getDueDate)
                .min(LocalDate::compareTo)
                .orElse(null);

        return new StudentStatementResponse(
                student.getId(),
                student.getFullName(),
                student.getStudentNumber(),
                currency,
                money(totalCharges),
                money(totalCredits),
                money(totalPayments),
                money(amountDue),
                nextDueDate,
                paymentMethods.contains(StudentPaymentMethod.DEMO_CHECKOUT),
                paymentMethods,
                toBankAccount(bankAccount),
                invoices.stream().map(invoice -> toInvoice(
                        invoice,
                        paymentsByInvoice.getOrDefault(invoice.getId(), List.of()),
                        packagesByInvoice.getOrDefault(invoice.getId(), List.of())
                )).toList()
        );
    }

    static InvoiceResponse toInvoice(StudentInvoice invoice) {
        return toInvoice(invoice, List.of(), List.of());
    }

    static InvoiceResponse toInvoice(StudentInvoice invoice, List<ManualPaymentSubmission> manualPayments) {
        return toInvoice(invoice, manualPayments, List.of());
    }

    static InvoiceResponse toInvoice(
            StudentInvoice invoice,
            List<ManualPaymentSubmission> manualPayments,
            SessionPackageUsageResponse sessionPackage
    ) {
        return toInvoice(invoice, manualPayments, sessionPackage == null ? List.of() : List.of(sessionPackage));
    }

    static InvoiceResponse toInvoice(
            StudentInvoice invoice,
            List<ManualPaymentSubmission> manualPayments,
            List<SessionPackageUsageResponse> sessionPackages
    ) {
        LearningEntitlementResponse primaryEntitlement = toEntitlement(invoice.getEntitlement());
        SessionPackageUsageResponse primaryPackage = sessionPackages.isEmpty() ? null : sessionPackages.getFirst();
        return new InvoiceResponse(
                invoice.getId(),
                invoice.getStudent().getFullName(),
                invoice.getStudent().getStudentNumber(),
                invoice.getInvoiceNumber(),
                invoice.getTitle(),
                invoice.getNote(),
                invoice.getDueDate(),
                invoice.getCurrency(),
                InvoiceStatusPolicy.current(invoice),
                charges(invoice),
                credits(invoice),
                payments(invoice),
                balance(invoice),
                invoice.getLineItems().stream().map(item -> new LineItemResponse(
                        item.getId(), item.getDescription(), item.getType(), item.getAmount()
                )).toList(),
                invoice.getTransactions().stream().map(transaction -> new TransactionResponse(
                        transaction.getId(), transaction.getAmount(), transaction.getStatus(),
                        transaction.getProvider(), transaction.getProviderReference(), transaction.getOccurredAt()
                )).toList(),
                manualPayments.stream().map(PaymentResponseMapper::toManualPayment).toList(),
                primaryEntitlement,
                primaryPackage,
                invoice.getEntitlements().stream().map(entitlement -> new CoursePurchaseResponse(
                        entitlement.getLineItem() == null ? null : entitlement.getLineItem().getId(),
                        toEntitlement(entitlement),
                        sessionPackages.stream()
                                .filter(item -> entitlement.getId().equals(item.entitlementId()))
                                .findFirst().orElse(null)
                )).toList(),
                invoice.getCreatedAt(),
                invoice.getMessageDraftSavedAt(),
                invoice.getMessageReviewedAt(),
                invoice.getLastEmailedAt()
        );
    }

    private static LearningEntitlementResponse toEntitlement(StudentLearningEntitlement entitlement) {
        if (entitlement == null) return null;
        var offering = entitlement.getCourseOffering();
        var session = entitlement.getClassroomSession();
        return new LearningEntitlementResponse(
                entitlement.getId(), offering.getId(), offering.getCourse().getCode(), offering.getAcademicTerm(),
                entitlement.getPurchaseMode(), entitlement.getStatus(), entitlement.getValidFrom(),
                entitlement.getValidTo(), entitlement.getSessionAllowance(), session == null ? null : session.getId(),
                session == null ? null : session.getDate()
        );
    }

    static BankAccountResponse toBankAccount(PaymentBankAccount account) {
        if (account == null) return null;
        return new BankAccountResponse(
                account.getId(), account.getAccountName(), account.getBankName(), account.getAccountNumber(),
                account.getPaymentReference(), account.getInstructions(), account.getUpdatedAt()
        );
    }

    static ManualPaymentResponse toManualPayment(ManualPaymentSubmission payment) {
        StudentInvoice invoice = payment.getInvoice();
        Student student = invoice.getStudent();
        return new ManualPaymentResponse(
                payment.getId(), invoice.getId(), student.getId(), student.getFullName(),
                student.getStudentNumber(), invoice.getTitle(), invoice.getInvoiceNumber(), InvoiceAmounts.balance(invoice),
                invoice.getCurrency(), payment.getAmount(),
                payment.getMethod(), payment.getStatus(), payment.getStudentNote(), payment.getOriginalFileName(),
                payment.getContentType(), payment.getFileSize(), payment.getSubmittedAt(),
                payment.getReviewNote(), payment.getReviewedAt(), payment.getReceivedDate()
        );
    }

    static AdminPaymentRowResponse toAdminRow(StudentInvoice invoice, LocalDate today) {
        Student student = invoice.getStudent();
        return new AdminPaymentRowResponse(
                invoice.getId(),
                student.getId(),
                student.getFullName(),
                student.getStudentNumber(),
                invoice.getTitle(),
                invoice.getDueDate(),
                invoice.getCurrency(),
                money(charges(invoice).subtract(credits(invoice))),
                payments(invoice),
                balance(invoice),
                InvoiceStatusPolicy.current(invoice, today)
        );
    }

    private static BigDecimal sum(
            List<StudentInvoice> invoices,
            Function<StudentInvoice, BigDecimal> amount
    ) {
        return invoices.stream().map(amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
