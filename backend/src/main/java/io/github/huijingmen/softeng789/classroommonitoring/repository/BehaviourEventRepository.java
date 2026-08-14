package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.BehaviourEvent;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BehaviourEventRepository extends JpaRepository<BehaviourEvent, UUID> {
}
