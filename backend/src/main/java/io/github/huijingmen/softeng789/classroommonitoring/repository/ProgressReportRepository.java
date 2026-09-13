package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ProgressReport;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProgressReportRepository extends JpaRepository<ProgressReport, UUID> {
    List<ProgressReport> findAllByOrderByCreatedAtDesc();

    List<ProgressReport> findByStudent_IdOrderByCreatedAtDesc(UUID studentId);

    List<ProgressReport> findByStudent_IdAndCourseOffering_IdOrderByCreatedAtAsc(
            UUID studentId, UUID courseOfferingId);

    List<ProgressReport> findByCourseOffering_IdOrderByCreatedAtDesc(UUID courseOfferingId);

    /** Backs "every report visible to me" for a plain teacher on the system-wide Reports page —
     *  same query shape HealthIncidentReportRepository already uses for the same purpose. */
    List<ProgressReport> findByCourseOffering_Teachers_IdOrderByCreatedAtDesc(UUID teacherId);
}
