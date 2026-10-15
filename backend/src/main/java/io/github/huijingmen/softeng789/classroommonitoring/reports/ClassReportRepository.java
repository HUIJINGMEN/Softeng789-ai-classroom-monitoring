package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassReportRepository extends JpaRepository<ClassReport, UUID> {
    Optional<ClassReport> findFirstByCourseOfferingIdAndCreatedByIdAndScopeKeyAndFinalizedAtIsNullOrderByCreatedAtDesc(
            UUID courseOfferingId, UUID createdById, String scopeKey);
    List<ClassReport> findTop10ByCourseOfferingIdAndFinalizedAtIsNotNullOrderByFinalizedAtDesc(UUID courseOfferingId);
}
