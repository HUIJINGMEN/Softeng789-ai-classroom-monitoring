package io.github.huijingmen.softeng789.classroommonitoring.support.repository;

import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentSupportRequest;
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

import jakarta.persistence.LockModeType;

public interface StudentSupportRequestRepository extends JpaRepository<StudentSupportRequest, UUID> {
    @EntityGraph(attributePaths = {"student", "courseOffering", "courseOffering.course", "session"})
    List<StudentSupportRequest> findByStudent_IdOrderBySubmittedAtDesc(UUID studentId);

    @EntityGraph(attributePaths = {"student", "courseOffering", "courseOffering.course", "session"})
    Page<StudentSupportRequest> findByStatus(StudentRequestStatus status, Pageable pageable);

    long countByStatus(StudentRequestStatus status);

    boolean existsByStudent_IdAndSession_IdAndStatusIn(
            UUID studentId,
            UUID sessionId,
            List<StudentRequestStatus> statuses
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"student", "courseOffering", "courseOffering.course", "session"})
    @Query("select request from StudentSupportRequest request where request.id = :id")
    Optional<StudentSupportRequest> findByIdForUpdate(@Param("id") UUID id);
}
