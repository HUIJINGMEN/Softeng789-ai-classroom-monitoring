package com.caspal.classroommonitoring.repository;

import com.caspal.classroommonitoring.entity.BehaviourEvent;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BehaviourEventRepository extends JpaRepository<BehaviourEvent, UUID> {
}
