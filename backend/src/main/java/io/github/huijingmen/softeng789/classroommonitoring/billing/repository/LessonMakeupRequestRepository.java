package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonMakeupRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonMakeupRequestStatus;
import java.util.Collection;
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

public interface LessonMakeupRequestRepository extends JpaRepository<LessonMakeupRequest, UUID> {
    @EntityGraph(attributePaths = {
            "student", "preferredSession", "preferredSession.roomEntity", "preferredSession.roomEntity.campus",
            "lessonCredit", "lessonCredit.originalSession", "lessonCredit.sessionPackage",
            "lessonCredit.sessionPackage.courseOffering", "lessonCredit.sessionPackage.courseOffering.course"
    })
    List<LessonMakeupRequest> findByStudent_IdOrderBySubmittedAtDesc(UUID studentId);

    @EntityGraph(attributePaths = {
            "student", "preferredSession", "preferredSession.roomEntity", "preferredSession.roomEntity.campus",
            "lessonCredit", "lessonCredit.originalSession", "lessonCredit.sessionPackage",
            "lessonCredit.sessionPackage.courseOffering", "lessonCredit.sessionPackage.courseOffering.course"
    })
    Page<LessonMakeupRequest> findByStatus(LessonMakeupRequestStatus status, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {
            "student", "preferredSession", "preferredSession.roomEntity", "preferredSession.roomEntity.campus",
            "lessonCredit", "lessonCredit.originalSession", "lessonCredit.sessionPackage",
            "lessonCredit.sessionPackage.courseOffering", "lessonCredit.sessionPackage.courseOffering.course"
    })
    Optional<LessonMakeupRequest> findById(UUID id);

    @EntityGraph(attributePaths = {
            "student", "preferredSession", "preferredSession.roomEntity", "preferredSession.roomEntity.campus",
            "lessonCredit", "lessonCredit.originalSession", "lessonCredit.sessionPackage",
            "lessonCredit.sessionPackage.courseOffering", "lessonCredit.sessionPackage.courseOffering.course"
    })
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select request from LessonMakeupRequest request where request.id = :id")
    Optional<LessonMakeupRequest> findByIdForReview(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"preferredSession", "lessonCredit"})
    List<LessonMakeupRequest> findByLessonCredit_IdInAndStatus(
            Collection<UUID> creditIds,
            LessonMakeupRequestStatus status
    );

    boolean existsByLessonCredit_IdAndStatus(UUID creditId, LessonMakeupRequestStatus status);
    long countByStatus(LessonMakeupRequestStatus status);
}
