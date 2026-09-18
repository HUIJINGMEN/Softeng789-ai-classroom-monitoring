package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Accomplishment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccomplishmentRepository extends JpaRepository<Accomplishment, UUID> {
    List<Accomplishment> findAllByOrderByAchievementDateDescCreatedAtDesc();

    List<Accomplishment> findByStudent_IdOrderByAchievementDateDescCreatedAtDesc(UUID studentId);

    List<Accomplishment> findByStudent_IdAndStatusOrderByAchievementDateDescCreatedAtDesc(
            UUID studentId,
            Accomplishment.Status status
    );

    List<Accomplishment> findByCourseOffering_IdOrderByAchievementDateDescCreatedAtDesc(UUID courseOfferingId);

    List<Accomplishment> findByCourseOffering_Teachers_IdOrderByAchievementDateDescCreatedAtDesc(UUID teacherId);
}
