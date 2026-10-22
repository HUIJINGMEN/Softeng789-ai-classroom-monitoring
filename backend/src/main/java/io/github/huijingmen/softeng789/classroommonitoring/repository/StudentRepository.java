package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudentRepository extends JpaRepository<Student, UUID> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select student from Student student where student.id = :id")
    Optional<Student> findForReportPreparation(@Param("id") UUID id);

    Optional<Student> findByStudentNumberIgnoreCase(String studentNumber);

    Optional<Student> findByUniversityEmailIgnoreCase(String universityEmail);

    List<Student> findByApprovalStatusOrderByCreatedAtAsc(String approvalStatus);

    List<Student> findByApprovalStatusOrderByLastNameAscFirstNameAsc(String approvalStatus);

    Page<Student> findByApprovalStatusOrderByLastNameAscFirstNameAscIdAsc(
            String approvalStatus,
            Pageable pageable
    );

    @Query("""
            select student
            from Student student
            where student.status = 'ACTIVE'
              and student.approvalStatus = 'APPROVED'
              and (
                exists (
                  select enrollment.id from CourseEnrollment enrollment
                  where enrollment.student = student
                    and enrollment.status = io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus.ACTIVE
                )
                or exists (
                  select invoice.id from StudentInvoice invoice
                  where invoice.student = student
                )
              )
              and (:query = '' or lower(concat(
                student.firstName, ' ', student.lastName, ' ', student.studentNumber, ' ',
                student.universityEmail, ' ', student.course
              )) like lower(concat('%', :query, '%')))
            order by student.lastName, student.firstName, student.studentNumber
            """)
    List<Student> searchActiveBillingStudents(@Param("query") String query);

    @Query("""
            select student from Student student
            where student.status = 'ACTIVE' and student.approvalStatus = 'APPROVED'
              and exists (
                select enrollment.id from CourseEnrollment enrollment
                where enrollment.student = student and enrollment.courseOffering.id = :offeringId
                  and enrollment.status = io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus.ACTIVE
              )
            order by student.lastName, student.firstName, student.studentNumber
            """)
    List<Student> findActiveStudentsInCourseOffering(@Param("offeringId") UUID offeringId);

    @Query("""
            select distinct student
            from CourseEnrollment enrollment
            join enrollment.student student
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

    @Query(value = """
            select distinct student
            from CourseEnrollment enrollment
            join enrollment.student student
            join enrollment.courseOffering offering
            join offering.teachers teacher
            where teacher.id = :teacherId
              and enrollment.status = :status
              and enrollment.student.approvalStatus = 'APPROVED'
            order by student.lastName, student.firstName, student.studentNumber
            """, countQuery = """
            select count(distinct student.id)
            from CourseEnrollment enrollment
            join enrollment.student student
            join enrollment.courseOffering offering
            join offering.teachers teacher
            where teacher.id = :teacherId
              and enrollment.status = :status
              and enrollment.student.approvalStatus = 'APPROVED'
            """)
    Page<Student> findApprovedStudentsVisibleToTeacher(
            @Param("teacherId") UUID teacherId,
            @Param("status") EnrollmentStatus status,
            Pageable pageable
    );
}
