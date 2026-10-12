package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AttendanceBillingOverride;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceBillingOverrideRepository extends JpaRepository<AttendanceBillingOverride, UUID> {
    List<AttendanceBillingOverride> findByAttendanceRecord_IdIn(Collection<UUID> attendanceRecordIds);
    Optional<AttendanceBillingOverride> findByAttendanceRecord_Id(UUID attendanceRecordId);
}
