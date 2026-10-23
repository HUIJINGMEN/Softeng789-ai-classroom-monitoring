package io.github.huijingmen.softeng789.classroommonitoring.vision;

import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentCheckInRepository extends JpaRepository<StudentCheckIn, UUID> {
    Optional<StudentCheckIn> findByStudentIdAndRequestKey(UUID studentId, UUID requestKey);
    Optional<StudentCheckIn> findFirstByStudentIdAndSessionIdOrderByCreatedAtDesc(UUID studentId, UUID sessionId);
    List<StudentCheckIn> findByStudentIdOrderById(UUID studentId);
    List<StudentCheckIn> findBySessionIdOrderByCreatedAtDesc(UUID sessionId);
    List<StudentCheckIn> findByExpiresAtBefore(Instant now);
}
