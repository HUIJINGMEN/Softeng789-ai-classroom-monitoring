package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseEnrollmentRepository extends JpaRepository<CourseEnrollment, UUID> {
    List<CourseEnrollment> findByStudent_IdOrderByCourseOffering_Course_CodeAsc(UUID studentId);

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

    long countByCourseOffering_IdAndStatus(UUID courseOfferingId, EnrollmentStatus status);

    List<CourseEnrollment> findByCourseOffering_IdAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
            UUID courseOfferingId,
            EnrollmentStatus status
    );

    /** Every active enrolment in a class this teacher teaches — used to scope the student list to
     *  "students I actually teach" instead of the whole system. */
    List<CourseEnrollment> findDistinctByCourseOffering_Teachers_IdAndStatus(UUID teacherId, EnrollmentStatus status);
}
