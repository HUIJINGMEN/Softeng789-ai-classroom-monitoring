package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.BehaviourEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BehaviourEventRepository extends JpaRepository<BehaviourEvent, UUID> {
    List<BehaviourEvent> findAllByOrderByTimestampDesc();

    List<BehaviourEvent> findBySession_CourseOffering_Teachers_IdOrderByTimestampDesc(UUID teacherId);
}
