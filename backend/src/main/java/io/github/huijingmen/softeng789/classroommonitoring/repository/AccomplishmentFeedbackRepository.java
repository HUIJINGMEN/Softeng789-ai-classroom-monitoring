package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AccomplishmentFeedback;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccomplishmentFeedbackRepository extends JpaRepository<AccomplishmentFeedback, UUID> {
    @Query("select distinct f.accomplishment.id from AccomplishmentFeedback f "
            + "where f.accomplishment.id in :ids and f.type = :type and f.status = :status")
    List<UUID> findAccomplishmentIdsByTypeAndStatus(@Param("ids") Collection<UUID> ids,
            @Param("type") AccomplishmentFeedback.Type type, @Param("status") AccomplishmentFeedback.Status status);

    boolean existsByAccomplishment_IdAndType(
            UUID accomplishmentId,
            AccomplishmentFeedback.Type type
    );

    Optional<AccomplishmentFeedback> findFirstByAccomplishment_IdAndTypeAndStatusOrderByCreatedAtDesc(
            UUID accomplishmentId,
            AccomplishmentFeedback.Type type,
            AccomplishmentFeedback.Status status
    );

    List<AccomplishmentFeedback> findByAccomplishment_IdInOrderByCreatedAtDesc(
            Collection<UUID> accomplishmentIds
    );
}
