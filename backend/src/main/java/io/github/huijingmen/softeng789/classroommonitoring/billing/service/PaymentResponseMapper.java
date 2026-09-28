package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts;
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
import java.util.function.Function;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.balance;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.charges;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.credits;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;
import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.payments;

final class PaymentResponseMapper {
    private PaymentResponseMapper() {
    }

    static StudentStatementResponse toStatement(Student student, List<StudentInvoice> invoices, String currency) {
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
                invoices.stream().map(PaymentResponseMapper::toInvoice).toList()
        );
    }

    static InvoiceResponse toInvoice(StudentInvoice invoice) {
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
                invoice.getCreatedAt()
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
