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
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionClock;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.LeaveReason;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestType;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequesterRole;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.CreateStudentSupportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.ReviewDecision;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.ReviewStudentSupportRequest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:leave-approval-workflow-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
@Transactional
class LeaveApprovalWorkflowIntegrationTest {
    @Autowired private StudentSupportRequestService requestService;
    @Autowired private AttendanceRecordRepository attendanceRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private TeacherRepository teacherRepository;
    @Autowired private CourseRepository courseRepository;
    @Autowired private CourseOfferingRepository offeringRepository;
    @Autowired private CourseEnrollmentRepository enrollmentRepository;
    @Autowired private ClassroomSessionRepository sessionRepository;

    private Student student;
    private Teacher admin;
    private CourseOffering offering;
    private ClassroomSession session;

    @BeforeEach
    void createUpcomingLessonAndEnrolledStudent() {
        student = new Student();
        student.setStudentNumber("LEAVE-1001");
        student.setUniversityEmail("leave-student@example.test");
        student.setFirstName("Ana");
        student.setLastName("Ngata");
        student.setCourse("DANCE 101");
        student.setSeat("A-01");
        student.setProgramme("Summer programme");
        student = studentRepository.save(student);

        admin = new Teacher();
        admin.setStaffNumber("ADMIN-LEAVE");
        admin.setEmail("leave-admin@example.test");
        admin.setName("Leave Admin");
        admin.setRole("ADMIN");
        admin = teacherRepository.save(admin);

        Course course = new Course();
        course.setCode("DANCE 101");
        course.setName("Summer dance");
        course = courseRepository.save(course);

        offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode("DANCE 101 · SUMMER 2026");
        offering.setAcademicTerm("Summer 2026");
        offering = offeringRepository.save(offering);

        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourseOffering(offering);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        enrollmentRepository.save(enrollment);

        session = new ClassroomSession();
        session.setCourse("DANCE 101");
        session.setCourseOffering(offering);
        session.setRoom("Studio 1");
        // Relative school-local dates never expire as the CI calendar advances.
        setLessonDate(LocalDate.now(SessionClock.AUCKLAND).plusDays(2));
        session.setStatus(ClassroomSession.SessionStatus.SCHEDULED);
        session = sessionRepository.save(session);
    }

    @Test
    void approvingLeaveUpdatesTheExactLessonAttendanceInTheSameWorkflow() {
        assertThat(session.getStartTime()).isAfter(Instant.now());
        var submitted = requestService.submit(student.getId(), leaveRequest());

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

    @Test
    void pastLessonIsRejectedEvenWhenItsStatusIsStillScheduled() {
        setLessonDate(LocalDate.now(SessionClock.AUCKLAND).minusDays(2));
        sessionRepository.saveAndFlush(session);

        assertThatThrownBy(() -> requestService.submit(student.getId(), leaveRequest()))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception -> {
                    assertThat(exception.getStatusCode()).isEqualTo(BAD_REQUEST);
                    assertThat(exception.getReason()).isEqualTo(
                            "Leave can only be requested for an upcoming lesson.");
                });
        assertThat(attendanceRepository.findBySession_IdAndStudent_Id(session.getId(), student.getId()))
                .isEmpty();
    }

    private void setLessonDate(LocalDate date) {
        session.setDate(date);
        session.setStartTime(SessionClock.instant(date, LocalTime.of(10, 0)));
        session.setEndTime(SessionClock.instant(date, LocalTime.of(11, 0)));
    }

    private CreateStudentSupportRequest leaveRequest() {
        return new CreateStudentSupportRequest(
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
        );
    }
}
