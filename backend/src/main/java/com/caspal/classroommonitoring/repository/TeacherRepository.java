package com.caspal.classroommonitoring.repository;

import com.caspal.classroommonitoring.entity.Teacher;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeacherRepository extends JpaRepository<Teacher, UUID> {
    Optional<Teacher> findByEmailIgnoreCase(String email);

    Optional<Teacher> findByStaffNumberIgnoreCase(String staffNumber);
}
