package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.BankTransferSubmission;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentBankAccount;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.BankAccountResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.BankTransferResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.AdminPaymentRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LineItemResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.StudentStatementResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.TransactionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
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
            Map<UUID, List<BankTransferSubmission>> transfersByInvoice
    ) {
        BigDecimal totalCharges = sum(invoices, InvoiceAmounts::charges);
        BigDecimal totalCredits = sum(invoices, InvoiceAmounts::credits);
        BigDecimal totalPayments = sum(invoices, InvoiceAmounts::payments);
        BigDecimal amountDue = invoices.stream()
                .filter(invoice -> invoice.getStatus().isOpen())
                .map(InvoiceAmounts::balance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        LocalDate nextDueDate = invoices.stream()
                .filter(invoice -> invoice.getStatus().isOpen())
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
                true,
                toBankAccount(bankAccount),
                invoices.stream().map(invoice -> toInvoice(
                        invoice,
                        transfersByInvoice.getOrDefault(invoice.getId(), List.of())
                )).toList()
        );
    }

    static InvoiceResponse toInvoice(StudentInvoice invoice) {
        return toInvoice(invoice, List.of());
    }

    static InvoiceResponse toInvoice(StudentInvoice invoice, List<BankTransferSubmission> transfers) {
        return new InvoiceResponse(
                invoice.getId(),
                invoice.getTitle(),
                invoice.getNote(),
                invoice.getDueDate(),
                invoice.getCurrency(),
                invoice.getStatus(),
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
                transfers.stream().map(PaymentResponseMapper::toBankTransfer).toList(),
                invoice.getCreatedAt()
        );
    }

    static BankAccountResponse toBankAccount(PaymentBankAccount account) {
        if (account == null) return null;
        return new BankAccountResponse(
                account.getId(), account.getAccountName(), account.getBankName(), account.getAccountNumber(),
                account.getPaymentReference(), account.getInstructions(), account.getUpdatedAt()
        );
    }

    static BankTransferResponse toBankTransfer(BankTransferSubmission transfer) {
        StudentInvoice invoice = transfer.getInvoice();
        Student student = invoice.getStudent();
        return new BankTransferResponse(
                transfer.getId(), invoice.getId(), student.getId(), student.getFullName(),
                student.getStudentNumber(), invoice.getTitle(), invoice.getCurrency(), transfer.getAmount(),
                transfer.getStatus(), transfer.getStudentNote(), transfer.getOriginalFileName(),
                transfer.getContentType(), transfer.getFileSize(), transfer.getSubmittedAt(),
                transfer.getReviewNote(), transfer.getReviewedAt()
        );
    }

    static AdminPaymentRowResponse toAdminRow(StudentInvoice invoice) {
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
                invoice.getStatus()
        );
    }

    private static BigDecimal sum(
            List<StudentInvoice> invoices,
            Function<StudentInvoice, BigDecimal> amount
    ) {
        return invoices.stream().map(amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
