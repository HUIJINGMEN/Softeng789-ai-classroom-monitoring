package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudentInvoiceRepository extends JpaRepository<StudentInvoice, UUID> {
    interface FinancialState {
        InvoiceStatus getLifecycleStatus();
        LocalDate getDueDate();
        String getCurrency();
        java.math.BigDecimal getNetCharges();
        java.math.BigDecimal getNetPayments();
    }

    @Query("select invoice.status as lifecycleStatus, invoice.dueDate as dueDate, invoice.currency as currency, "
            + InvoiceStatusQuery.NET_CHARGES + " as netCharges, " + InvoiceStatusQuery.NET_PAYMENTS
            + " as netPayments from StudentInvoice invoice")
    List<FinancialState> financialStates();
    @Query("""
            select distinct invoice from StudentInvoice invoice
            left join fetch invoice.lineItems
            where invoice.student.id = :studentId
              and invoice.status <> io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus.DRAFT
            order by invoice.dueDate desc, invoice.createdAt desc
            """)
    List<StudentInvoice> findStatementByStudentId(@Param("studentId") UUID studentId);

    @Query("""
            select distinct invoice from StudentInvoice invoice
            left join fetch invoice.lineItems
            where invoice.id = :invoiceId and invoice.student.id = :studentId
              and invoice.status <> io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus.DRAFT
            """)
    Optional<StudentInvoice> findForStudent(
            @Param("invoiceId") UUID invoiceId,
            @Param("studentId") UUID studentId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select invoice from StudentInvoice invoice
            where invoice.id = :invoiceId and invoice.student.id = :studentId
              and invoice.status <> io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus.DRAFT
            """)
    Optional<StudentInvoice> findForStudentForUpdate(
            @Param("invoiceId") UUID invoiceId,
            @Param("studentId") UUID studentId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select invoice from StudentInvoice invoice where invoice.id = :invoiceId")
    Optional<StudentInvoice> findByIdForUpdate(@Param("invoiceId") UUID invoiceId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"student"})
    List<StudentInvoice> findByStudent_IdInOrderByDueDateAscCreatedAtDesc(Collection<UUID> studentIds);

    @Query("""
            select invoice from StudentInvoice invoice
            join invoice.student student
            where (:query = '' or lower(concat(student.firstName, ' ', student.lastName, ' ',
                student.studentNumber, ' ', invoice.title)) like lower(concat('%', :query, '%')))
              and (:status is null or
            """ + InvoiceStatusQuery.CURRENT_STATUS + " = :status)")
    Page<StudentInvoice> search(
            @Param("query") String query,
            @Param("status") InvoiceStatus status,
            @Param("today") LocalDate today,
            Pageable pageable
    );

    @Query("""
            select invoice from StudentInvoice invoice
            where invoice.status <> io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus.DRAFT
            order by invoice.createdAt asc, invoice.id asc
            """)
    List<StudentInvoice> findForOperations();

}
