package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.HealthAlert;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HealthAlertRepository extends JpaRepository<HealthAlert, UUID> {
    List<HealthAlert> findAllByOrderByDetectedAtDesc();

    List<HealthAlert> findBySession_CourseOffering_Teachers_IdOrderByDetectedAtDesc(UUID teacherId);
}
