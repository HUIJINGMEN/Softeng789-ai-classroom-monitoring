package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.FaceEnrollment;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FaceEnrollmentRepository extends JpaRepository<FaceEnrollment, UUID> {
    Optional<FaceEnrollment> findByStudent_Id(UUID studentId);

    List<FaceEnrollment> findByStudent_IdIn(Collection<UUID> studentIds);
}
