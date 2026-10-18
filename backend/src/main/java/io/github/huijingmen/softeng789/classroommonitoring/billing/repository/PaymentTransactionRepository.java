package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentTransaction;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, UUID> {
    interface PeriodTotal {
        UUID getInvoiceId();
        BigDecimal getReceived();
        BigDecimal getRefunded();
    }

    @Query("""
            select transaction.invoice.id as invoiceId,
              sum(case when transaction.status = :succeeded then transaction.amount else 0 end) as received,
              sum(case when transaction.status = :refunded then transaction.amount else 0 end) as refunded
            from PaymentTransaction transaction
            where transaction.occurredAt >= :fromInclusive and transaction.occurredAt < :toExclusive
              and (transaction.status = :succeeded or transaction.status = :refunded)
              and transaction.invoice.status <> io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus.DRAFT
            group by transaction.invoice.id
            """)
    List<PeriodTotal> totalsInPeriod(@Param("fromInclusive") Instant fromInclusive,
            @Param("toExclusive") Instant toExclusive, @Param("succeeded") PaymentStatus succeeded,
            @Param("refunded") PaymentStatus refunded);

    @Query("""
            select coalesce(sum(transaction.amount), 0)
            from PaymentTransaction transaction
            where transaction.status = :status
            """)
    BigDecimal sumAmountByStatus(@Param("status") PaymentStatus status);

    @Query("""
            select coalesce(sum(transaction.amount), 0)
            from PaymentTransaction transaction
            where transaction.status = :status and transaction.invoice.status in :invoiceStatuses
            """)
    BigDecimal sumAmountByStatusAndInvoiceStatusIn(
            @Param("status") PaymentStatus status,
            @Param("invoiceStatuses") Collection<InvoiceStatus> invoiceStatuses
    );
}
