package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentSubmission;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ManualPaymentSubmissionRepository extends JpaRepository<ManualPaymentSubmission, UUID> {
    boolean existsByInvoiceIdAndStatus(UUID invoiceId, ManualPaymentStatus status);

    @EntityGraph(attributePaths = {"invoice", "invoice.student"})
    List<ManualPaymentSubmission> findByInvoiceStudentIdOrderBySubmittedAtDesc(UUID studentId);

    @EntityGraph(attributePaths = {"invoice", "invoice.student"})
    Page<ManualPaymentSubmission> findByStatus(ManualPaymentStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"invoice", "invoice.student"})
    List<ManualPaymentSubmission> findByInvoice_Student_IdInAndStatusOrderBySubmittedAtAsc(
            List<UUID> studentIds,
            ManualPaymentStatus status
    );

    @EntityGraph(attributePaths = {"invoice", "invoice.student"})
    Optional<ManualPaymentSubmission> findWithInvoiceById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select submission from ManualPaymentSubmission submission where submission.id = :id")
    Optional<ManualPaymentSubmission> findByIdForReview(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"invoice", "invoice.student", "reviewedByAdmin"})
    List<ManualPaymentSubmission> findByInvoice_IdOrderBySubmittedAtAsc(UUID invoiceId);
}
