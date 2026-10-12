package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonCreditEventRepository extends JpaRepository<LessonCreditEvent, UUID> {
    @EntityGraph(attributePaths = {"sourceSession", "targetSession", "actor"})
    List<LessonCreditEvent> findByLessonCredit_IdOrderByCreatedAtAsc(UUID creditId);
}
