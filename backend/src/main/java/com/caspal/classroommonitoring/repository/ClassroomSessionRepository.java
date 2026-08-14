package com.caspal.classroommonitoring.repository;

import com.caspal.classroommonitoring.entity.ClassroomSession;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassroomSessionRepository extends JpaRepository<ClassroomSession, UUID> {
    List<ClassroomSession> findAllByOrderByDateDescStartTimeDesc();
}
