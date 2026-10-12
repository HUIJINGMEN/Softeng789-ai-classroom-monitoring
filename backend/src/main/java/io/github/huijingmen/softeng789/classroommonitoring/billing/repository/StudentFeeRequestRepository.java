package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.FeeRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentFeeRequest;
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

public interface StudentFeeRequestRepository extends JpaRepository<StudentFeeRequest, UUID> {
    @EntityGraph(attributePaths = {"student", "invoice"})
    List<StudentFeeRequest> findByStudent_IdOrderBySubmittedAtDesc(UUID studentId);
    @EntityGraph(attributePaths = {"student", "invoice"})
    Page<StudentFeeRequest> findByStatus(FeeRequestStatus status, Pageable pageable);
    @EntityGraph(attributePaths = {"student", "invoice"})
    Page<StudentFeeRequest> findAllByOrderBySubmittedAtDesc(Pageable pageable);
    @Override @EntityGraph(attributePaths = {"student", "invoice"})
    Optional<StudentFeeRequest> findById(UUID id);

    @EntityGraph(attributePaths = {"student", "invoice"})
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select request from StudentFeeRequest request where request.id = :id")
    Optional<StudentFeeRequest> findByIdForReview(@Param("id") UUID id);

    long countByStatus(FeeRequestStatus status);
}
