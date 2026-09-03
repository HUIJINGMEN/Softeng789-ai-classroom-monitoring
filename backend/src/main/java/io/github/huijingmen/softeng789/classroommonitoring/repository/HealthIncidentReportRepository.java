package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.HealthIncidentReport;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HealthIncidentReportRepository extends JpaRepository<HealthIncidentReport, UUID> {
    List<HealthIncidentReport> findAllByOrderByCreatedAtDesc();

    List<HealthIncidentReport> findByCourseOffering_Teachers_IdOrderByCreatedAtDesc(UUID teacherId);
}
