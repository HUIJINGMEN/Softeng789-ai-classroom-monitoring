package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceLineItem;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvoiceLineItemRepository extends JpaRepository<InvoiceLineItem, UUID> {
    @Query("""
            select coalesce(sum(item.amount), 0)
            from InvoiceLineItem item
            where item.type = :type and item.invoice.status in :statuses
            """)
    BigDecimal sumAmountByTypeAndInvoiceStatusIn(
            @Param("type") LineItemType type,
            @Param("statuses") Collection<InvoiceStatus> statuses
    );
}
