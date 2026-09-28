package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudentInvoiceRepository extends JpaRepository<StudentInvoice, UUID> {
    @Query("""
            select distinct invoice from StudentInvoice invoice
            left join fetch invoice.lineItems
            where invoice.student.id = :studentId
            order by invoice.dueDate desc, invoice.createdAt desc
            """)
    List<StudentInvoice> findStatementByStudentId(@Param("studentId") UUID studentId);

    @Query("""
            select distinct invoice from StudentInvoice invoice
            left join fetch invoice.lineItems
            where invoice.id = :invoiceId and invoice.student.id = :studentId
            """)
    Optional<StudentInvoice> findForStudent(
            @Param("invoiceId") UUID invoiceId,
            @Param("studentId") UUID studentId
    );

    @Query("""
            select invoice from StudentInvoice invoice
            join invoice.student student
            where (:query = '' or lower(concat(student.firstName, ' ', student.lastName, ' ',
                student.studentNumber, ' ', invoice.title)) like lower(concat('%', :query, '%')))
              and (:status is null or invoice.status = :status)
            """)
    Page<StudentInvoice> search(
            @Param("query") String query,
            @Param("status") InvoiceStatus status,
            Pageable pageable
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update StudentInvoice invoice
            set invoice.status = :overdueStatus
            where invoice.status in :currentStatuses and invoice.dueDate < :today
            """)
    int markOverdue(
            @Param("currentStatuses") Collection<InvoiceStatus> currentStatuses,
            @Param("overdueStatus") InvoiceStatus overdueStatus,
            @Param("today") LocalDate today
    );

    long countByStatus(InvoiceStatus status);

    long countByStatusIn(Collection<InvoiceStatus> statuses);
}
