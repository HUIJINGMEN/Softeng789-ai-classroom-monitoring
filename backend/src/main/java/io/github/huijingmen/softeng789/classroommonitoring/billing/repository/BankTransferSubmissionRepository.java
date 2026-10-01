package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.BankTransferStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.BankTransferSubmission;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BankTransferSubmissionRepository extends JpaRepository<BankTransferSubmission, UUID> {
    boolean existsByInvoiceIdAndStatus(UUID invoiceId, BankTransferStatus status);

    List<BankTransferSubmission> findByInvoiceStudentIdOrderBySubmittedAtDesc(UUID studentId);

    @EntityGraph(attributePaths = {"invoice", "invoice.student"})
    Page<BankTransferSubmission> findByStatus(BankTransferStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"invoice", "invoice.student"})
    Optional<BankTransferSubmission> findWithInvoiceById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select transfer from BankTransferSubmission transfer where transfer.id = :id")
    Optional<BankTransferSubmission> findByIdForReview(@Param("id") UUID id);
}
