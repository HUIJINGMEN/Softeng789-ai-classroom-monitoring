package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentTransaction;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import java.math.BigDecimal;
import java.time.Instant;
import org.springframework.stereotype.Service;

import static io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts.money;

@Service
public class PaymentLedgerService {
    public void recordSuccessfulPayment(
            StudentInvoice invoice,
            BigDecimal amount,
            String provider,
            String reference,
            Instant occurredAt
    ) {
        PaymentTransaction transaction = new PaymentTransaction();
        transaction.setAmount(money(amount));
        transaction.setStatus(PaymentStatus.SUCCEEDED);
        transaction.setProvider(provider);
        transaction.setProviderReference(reference);
        transaction.setOccurredAt(occurredAt);
        invoice.addTransaction(transaction);
        refreshStatus(invoice);
    }

    public void recordRefund(
            StudentInvoice invoice,
            BigDecimal amount,
            String provider,
            String reference,
            Instant occurredAt
    ) {
        PaymentTransaction transaction = new PaymentTransaction();
        transaction.setAmount(money(amount));
        transaction.setStatus(PaymentStatus.REFUNDED);
        transaction.setProvider(provider);
        transaction.setProviderReference(reference);
        transaction.setOccurredAt(occurredAt);
        invoice.addTransaction(transaction);
        refreshStatus(invoice);
    }

    public void refreshStatus(StudentInvoice invoice) {
        invoice.setStatus(InvoiceStatusPolicy.current(invoice));
    }
}
