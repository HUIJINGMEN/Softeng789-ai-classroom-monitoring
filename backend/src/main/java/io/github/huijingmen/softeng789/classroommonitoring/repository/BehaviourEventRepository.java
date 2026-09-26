package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.BehaviourEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface BehaviourEventRepository extends
        JpaRepository<BehaviourEvent, UUID>,
        JpaSpecificationExecutor<BehaviourEvent> {
    List<BehaviourEvent> findAllByOrderByTimestampDesc();

    @EntityGraph(attributePaths = {"student", "session"})
    Page<BehaviourEvent> findAllByOrderByTimestampDescIdDesc(Pageable pageable);

    List<BehaviourEvent> findBySession_CourseOffering_Teachers_IdOrderByTimestampDesc(UUID teacherId);

    @EntityGraph(attributePaths = {"student", "session"})
    Page<BehaviourEvent> findBySession_CourseOffering_Teachers_IdOrderByTimestampDescIdDesc(
            UUID teacherId,
            Pageable pageable
    );
}
