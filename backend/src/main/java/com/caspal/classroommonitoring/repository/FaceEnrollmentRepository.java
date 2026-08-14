package com.caspal.classroommonitoring.repository;

import com.caspal.classroommonitoring.entity.FaceEnrollment;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FaceEnrollmentRepository extends JpaRepository<FaceEnrollment, UUID> {
    Optional<FaceEnrollment> findByStudent_Id(UUID studentId);
}
