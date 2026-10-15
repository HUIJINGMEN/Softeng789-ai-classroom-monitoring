package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentReportEmailRepository extends JpaRepository<StudentReportEmailDelivery, UUID> {
    Optional<StudentReportEmailDelivery> findByReportIdAndReportVersion(UUID reportId, long reportVersion);
}
