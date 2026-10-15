package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OverallReportRepository extends JpaRepository<OverallReport, UUID> {
    Optional<OverallReport> findFirstByCreatedByIdAndScopeKeyAndFinalizedAtIsNullOrderByCreatedAtDesc(UUID caller, String scopeKey);
    List<OverallReport> findTop10ByFinalizedAtIsNotNullOrderByFinalizedAtDesc();
}
