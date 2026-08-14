package com.caspal.classroommonitoring.repository;

import com.caspal.classroommonitoring.entity.CourseOffering;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseOfferingRepository extends JpaRepository<CourseOffering, UUID> {
    Optional<CourseOffering> findByOfferingCodeIgnoreCase(String offeringCode);
}
