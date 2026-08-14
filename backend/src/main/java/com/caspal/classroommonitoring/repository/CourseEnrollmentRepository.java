package com.caspal.classroommonitoring.repository;

import com.caspal.classroommonitoring.entity.CourseEnrollment;
import com.caspal.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseEnrollmentRepository extends JpaRepository<CourseEnrollment, UUID> {
    List<CourseEnrollment> findByStudent_IdOrderByCourse_CodeAsc(UUID studentId);

    void deleteByStudent_Id(UUID studentId);

    boolean existsByStudent_IdAndCourse_CodeIgnoreCase(UUID studentId, String courseCode);

    List<CourseEnrollment> findByCourse_CodeIgnoreCaseAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
            String courseCode,
            EnrollmentStatus status
    );
}
