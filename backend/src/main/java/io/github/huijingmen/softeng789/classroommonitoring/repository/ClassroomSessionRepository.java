package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassroomSessionRepository extends JpaRepository<ClassroomSession, UUID> {
    List<ClassroomSession> findAllByOrderByDateDescStartTimeDesc();

    /** Only the sessions belonging to a class this teacher teaches — used to scope the session
     *  list to "my classes" instead of the whole system. */
    List<ClassroomSession> findByCourseOffering_Teachers_IdOrderByDateDescStartTimeDesc(UUID teacherId);

    List<ClassroomSession> findByStatusAndStartTimeLessThanEqual(SessionStatus status, Instant now);

    List<ClassroomSession> findByStatusAndEndTimeLessThanEqual(SessionStatus status, Instant now);
}
