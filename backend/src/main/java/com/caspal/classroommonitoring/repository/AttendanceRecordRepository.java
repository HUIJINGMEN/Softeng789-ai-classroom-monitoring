package com.caspal.classroommonitoring.repository;

import com.caspal.classroommonitoring.entity.AttendanceRecord;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, UUID> {
    List<AttendanceRecord> findBySession_Id(UUID sessionId);

    Optional<AttendanceRecord> findBySession_IdAndStudent_Id(UUID sessionId, UUID studentId);
}
