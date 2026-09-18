package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Accomplishment;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccomplishmentRepository extends JpaRepository<Accomplishment, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select accomplishment from Accomplishment accomplishment where accomplishment.id = :id")
    Optional<Accomplishment> findByIdForUpdate(@Param("id") UUID id);

    List<Accomplishment> findAllByOrderByAchievementDateDescCreatedAtDesc();

    List<Accomplishment> findByStudent_IdOrderByAchievementDateDescCreatedAtDesc(UUID studentId);

    List<Accomplishment> findByStudent_IdAndStatusOrderByAchievementDateDescCreatedAtDesc(
            UUID studentId,
            Accomplishment.Status status
    );

    List<Accomplishment> findByCourseOffering_IdOrderByAchievementDateDescCreatedAtDesc(UUID courseOfferingId);

    List<Accomplishment> findByCourseOffering_Teachers_IdOrderByAchievementDateDescCreatedAtDesc(UUID teacherId);
}
