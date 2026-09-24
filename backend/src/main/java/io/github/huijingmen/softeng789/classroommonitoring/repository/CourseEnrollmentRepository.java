package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseEnrollmentRepository extends JpaRepository<CourseEnrollment, UUID> {
    List<CourseEnrollment> findByStudent_IdOrderByCourseOffering_Course_CodeAsc(UUID studentId);

    List<CourseEnrollment> findByStudent_IdInAndStatusOrderByCourseOffering_Course_CodeAsc(
            Collection<UUID> studentIds,
            EnrollmentStatus status
    );

    List<CourseEnrollment> findByStudent_IdAndStatus(UUID studentId, EnrollmentStatus status);

    Optional<CourseEnrollment> findByStudent_IdAndCourseOffering_Id(UUID studentId, UUID courseOfferingId);

    Optional<CourseEnrollment> findByStudent_IdAndCourseOffering_IdAndStatus(
            UUID studentId,
            UUID courseOfferingId,
            EnrollmentStatus status
    );

    boolean existsByStudent_IdAndCourseOffering_IdAndStatus(
            UUID studentId,
            UUID courseOfferingId,
            EnrollmentStatus status
    );

    boolean existsByStudent_IdAndCourseOffering_Teachers_IdAndStatus(
            UUID studentId,
            UUID teacherId,
            EnrollmentStatus status
    );

    long countByCourseOffering_IdAndStatus(UUID courseOfferingId, EnrollmentStatus status);

    List<CourseEnrollment> findByCourseOffering_IdAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
            UUID courseOfferingId,
            EnrollmentStatus status
    );

    @EntityGraph(attributePaths = {"student", "courseOffering"})
    List<CourseEnrollment> findByCourseOffering_IdInAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
            Collection<UUID> courseOfferingIds,
            EnrollmentStatus status
    );

}
