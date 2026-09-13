package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassFeedback;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassFeedbackRepository extends JpaRepository<ClassFeedback, UUID> {
    List<ClassFeedback> findAllByOrderByCreatedAtDesc();

    List<ClassFeedback> findByCourseOffering_IdOrderByCreatedAtDesc(UUID courseOfferingId);

    List<ClassFeedback> findByCourseOffering_Teachers_IdOrderByCreatedAtDesc(UUID teacherId);
}
