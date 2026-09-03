package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseOfferingRepository extends JpaRepository<CourseOffering, UUID> {
    Optional<CourseOffering> findByOfferingCodeIgnoreCase(String offeringCode);

    List<CourseOffering> findAllByOrderByOfferingCodeAsc();

    List<CourseOffering> findAllByStatusOrderByOfferingCodeAsc(String status);

    List<CourseOffering> findByTeachers_IdAndStatusOrderByOfferingCodeAsc(UUID teacherId, String status);
}
