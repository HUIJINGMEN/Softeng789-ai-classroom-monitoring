package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface ClassroomSessionRepository extends
        JpaRepository<ClassroomSession, UUID>,
        JpaSpecificationExecutor<ClassroomSession> {
    @EntityGraph(attributePaths = {"courseOffering", "courseOffering.course", "roomEntity", "roomEntity.campus", "teacher"})
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select session from ClassroomSession session where session.id = :id")
    Optional<ClassroomSession> findForUpdateById(@Param("id") UUID id);

    List<ClassroomSession> findAllByOrderByDateDescStartTimeDesc();

    @EntityGraph(attributePaths = {"courseOffering", "roomEntity", "roomEntity.campus", "teacher"})
    Page<ClassroomSession> findAllByOrderByDateDescStartTimeDescIdDesc(Pageable pageable);

    /** Only the sessions belonging to a class this teacher teaches — used to scope the session
     *  list to "my classes" instead of the whole system. */
    List<ClassroomSession> findByCourseOffering_Teachers_IdOrderByDateDescStartTimeDesc(UUID teacherId);

    @EntityGraph(attributePaths = {"courseOffering", "roomEntity", "roomEntity.campus", "teacher"})
    Page<ClassroomSession> findByCourseOffering_Teachers_IdOrderByDateDescStartTimeDescIdDesc(
            UUID teacherId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"courseOffering", "courseOffering.teachers", "teacher"})
    List<ClassroomSession> findByIdIn(Collection<UUID> ids);

    List<ClassroomSession> findByStatusAndStartTimeLessThanEqual(SessionStatus status, Instant now);

    List<ClassroomSession> findByStatusAndEndTimeLessThanEqual(SessionStatus status, Instant now);

    List<ClassroomSession> findByCourseOffering_IdAndDateBetweenAndStatusOrderByDateAscStartTimeAsc(
            UUID offeringId,
            LocalDate dateFrom,
            LocalDate dateTo,
            SessionStatus status
    );

    @EntityGraph(attributePaths = {"courseOffering", "courseOffering.course", "roomEntity", "roomEntity.campus", "teacher"})
    List<ClassroomSession> findByCourseOffering_IdAndDateBetweenOrderByDateAscStartTimeAsc(
            UUID offeringId,
            LocalDate dateFrom,
            LocalDate dateTo
    );

    @EntityGraph(attributePaths = {"courseOffering", "courseOffering.course", "roomEntity", "roomEntity.campus", "teacher"})
    List<ClassroomSession> findByCourseOffering_IdInOrderByDateAscStartTimeAsc(Collection<UUID> offeringIds);

    @EntityGraph(attributePaths = {"courseOffering", "courseOffering.course", "roomEntity", "roomEntity.campus", "teacher"})
    List<ClassroomSession> findByDateInAndStatusNot(
            Collection<LocalDate> dates,
            SessionStatus status
    );

    @EntityGraph(attributePaths = {"courseOffering", "courseOffering.course", "roomEntity", "roomEntity.campus", "teacher"})
    List<ClassroomSession> findByScheduleSeriesIdAndDateGreaterThanEqualAndStatusOrderByDateAscStartTimeAsc(
            UUID scheduleSeriesId,
            LocalDate date,
            SessionStatus status
    );
}
