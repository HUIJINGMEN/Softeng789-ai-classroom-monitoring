package com.caspal.classroommonitoring.repository;

import com.caspal.classroommonitoring.entity.Course;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseRepository extends JpaRepository<Course, UUID> {
    Optional<Course> findByCodeIgnoreCase(String code);
}
