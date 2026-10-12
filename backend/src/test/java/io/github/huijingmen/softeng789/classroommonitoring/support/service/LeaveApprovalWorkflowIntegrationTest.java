package io.github.huijingmen.softeng789.classroommonitoring.support.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AbsenceReason;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.LeaveReason;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestType;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequesterRole;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.CreateStudentSupportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.ReviewDecision;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.ReviewStudentSupportRequest;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:leave-approval-workflow-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class LeaveApprovalWorkflowIntegrationTest {
    @Autowired private StudentSupportRequestService requestService;
    @Autowired private AttendanceRecordRepository attendanceRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private TeacherRepository teacherRepository;
    @Autowired private CourseRepository courseRepository;
    @Autowired private CourseOfferingRepository offeringRepository;
    @Autowired private CourseEnrollmentRepository enrollmentRepository;
    @Autowired private ClassroomSessionRepository sessionRepository;

    @Test
    void approvingLeaveUpdatesTheExactLessonAttendanceInTheSameWorkflow() {
        Student student = new Student();
        student.setStudentNumber("LEAVE-1001");
        student.setUniversityEmail("leave-student@example.test");
        student.setFirstName("Ana");
        student.setLastName("Ngata");
        student.setCourse("DANCE 101");
        student.setSeat("A-01");
        student.setProgramme("Summer programme");
        student = studentRepository.save(student);

        Teacher admin = new Teacher();
        admin.setStaffNumber("ADMIN-LEAVE");
        admin.setEmail("leave-admin@example.test");
        admin.setName("Leave Admin");
        admin.setRole("ADMIN");
        admin = teacherRepository.save(admin);

        Course course = new Course();
        course.setCode("DANCE 101");
        course.setName("Summer dance");
        course = courseRepository.save(course);

        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode("DANCE 101 · SUMMER 2026");
        offering.setAcademicTerm("Summer 2026");
        offering = offeringRepository.save(offering);

        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourseOffering(offering);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        enrollmentRepository.save(enrollment);

        ClassroomSession session = new ClassroomSession();
        session.setCourse("DANCE 101");
        session.setCourseOffering(offering);
        session.setRoom("Studio 1");
        session.setDate(LocalDate.of(2026, 10, 20));
        session.setStartTime(Instant.parse("2026-10-20T02:00:00Z"));
        session.setEndTime(Instant.parse("2026-10-20T03:00:00Z"));
        session.setStatus(ClassroomSession.SessionStatus.SCHEDULED);
        session = sessionRepository.save(session);

        var submitted = requestService.submit(student.getId(), new CreateStudentSupportRequest(
                StudentRequestType.LEAVE,
                StudentRequesterRole.STUDENT,
                null,
                null,
                null,
                null,
                offering.getId(),
                session.getId(),
                LeaveReason.FAMILY,
                "Leave request",
                "I will be away with my family."
        ));

        assertThat(submitted.lessonTreatmentRequired()).isFalse();

        var approved = requestService.review(
                admin.getId(),
                submitted.id(),
                new ReviewStudentSupportRequest(ReviewDecision.APPROVE, "Approved before the lesson.")
        );

        assertThat(approved.status()).isEqualTo(StudentRequestStatus.APPROVED);
        assertThat(approved.lessonTreatment()).isNull();
        assertThat(attendanceRepository.findBySession_IdAndStudent_Id(session.getId(), student.getId()))
                .get()
                .satisfies(attendance -> {
                    assertThat(attendance.getStatus()).isEqualTo(AttendanceStatus.ABSENT);
                    assertThat(attendance.getAbsenceReason()).isEqualTo(AbsenceReason.ADVANCE_NOTICE);
                    assertThat(attendance.getAbsenceNote()).contains("Approved leave request");
                    assertThat(attendance.getAbsenceNote()).contains("Approved before the lesson.");
                });
    }
}
