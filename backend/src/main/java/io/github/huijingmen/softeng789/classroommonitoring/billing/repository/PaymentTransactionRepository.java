package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PaymentTransaction;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, UUID> {
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
