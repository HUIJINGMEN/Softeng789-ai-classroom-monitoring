package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AccomplishmentFeedback;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccomplishmentFeedbackRepository extends JpaRepository<AccomplishmentFeedback, UUID> {
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
