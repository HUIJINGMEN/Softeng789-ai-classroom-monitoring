package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudentRepository extends JpaRepository<Student, UUID> {
    Optional<Student> findByStudentNumberIgnoreCase(String studentNumber);

    Optional<Student> findByUniversityEmailIgnoreCase(String universityEmail);

    List<Student> findByApprovalStatusOrderByCreatedAtAsc(String approvalStatus);

    List<Student> findByApprovalStatusOrderByLastNameAscFirstNameAsc(String approvalStatus);

    @Query("""
            select distinct enrollment.student
            from CourseEnrollment enrollment
            join enrollment.courseOffering offering
            join offering.teachers teacher
            where teacher.id = :teacherId
              and enrollment.status = :status
              and enrollment.student.approvalStatus = 'APPROVED'
            order by enrollment.student.lastName, enrollment.student.firstName
            """)
    List<Student> findApprovedStudentsVisibleToTeacher(
            @Param("teacherId") UUID teacherId,
            @Param("status") EnrollmentStatus status
    );
}
