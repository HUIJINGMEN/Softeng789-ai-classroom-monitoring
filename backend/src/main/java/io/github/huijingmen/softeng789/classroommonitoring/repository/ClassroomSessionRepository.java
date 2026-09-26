package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ClassroomSessionRepository extends
        JpaRepository<ClassroomSession, UUID>,
        JpaSpecificationExecutor<ClassroomSession> {
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
}
