package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateAttendanceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceSource;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:attendance-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class AttendanceServiceTest {
    @Autowired
    private AttendanceService attendanceService;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private ClassroomSessionRepository classroomSessionRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private CourseOfferingRepository courseOfferingRepository;

    @Autowired
    private CourseEnrollmentRepository courseEnrollmentRepository;

    @Autowired
    private StudentRepository studentRepository;

    @BeforeEach
    void cleanDatabase() {
        attendanceRecordRepository.deleteAll();
        courseEnrollmentRepository.deleteAll();
        studentRepository.deleteAll();
        classroomSessionRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
    }

    @Test
    void manualAttendanceUpdateIsPersistedAndRosterOnlyReflectsRealEnrolments() {
        CourseOffering softengOffering = offering("SOFTENG 789");
        CourseOffering compsciOffering = offering("COMPSCI 730");

        Student student = new Student();
        student.setStudentNumber("UOA-TEST-001");
        student.setUniversityEmail("uoa-test-001@aucklanduni.ac.nz");
        student.setFirstName("Test");
        student.setLastName("Student");
        student.setCourse("COMPSCI 730");
        student.setSeat("A-01");
        student.setProgramme("Master of Engineering Studies");
        student.setConsentGiven(true);
        student = studentRepository.save(student);
        enrol(student, softengOffering);
        var studentId = student.getId();

        Student otherStudent = new Student();
        otherStudent.setStudentNumber("UOA-TEST-002");
        otherStudent.setUniversityEmail("uoa-test-002@aucklanduni.ac.nz");
        otherStudent.setFirstName("Other");
        otherStudent.setLastName("Student");
        otherStudent.setCourse("COMPSCI 730");
        otherStudent.setSeat("A-02");
        otherStudent.setProgramme("Master of Engineering Studies");
        otherStudent.setConsentGiven(true);
        otherStudent = studentRepository.save(otherStudent);
        enrol(otherStudent, compsciOffering);

        // Descriptive "course" text matching the session's course by coincidence is not enough to
        // appear on the roster — only a real enrolment against this class does.
        Student descriptiveOnlyStudent = new Student();
        descriptiveOnlyStudent.setStudentNumber("UOA-TEST-003");
        descriptiveOnlyStudent.setUniversityEmail("uoa-test-003@aucklanduni.ac.nz");
        descriptiveOnlyStudent.setFirstName("Descriptive");
        descriptiveOnlyStudent.setLastName("Only");
        descriptiveOnlyStudent.setCourse("SOFTENG 789");
        descriptiveOnlyStudent.setSeat("A-03");
        descriptiveOnlyStudent.setProgramme("Master of Engineering Studies");
        descriptiveOnlyStudent.setConsentGiven(true);
        studentRepository.save(descriptiveOnlyStudent);

        ClassroomSession session = new ClassroomSession();
        session.setCourse("SOFTENG 789");
        session.setCourseOffering(softengOffering);
        session.setRoom("Room 405-460");
        session.setDate(LocalDate.of(2026, 8, 13));
        session.setStartTime(Instant.parse("2026-08-13T10:00:00Z"));
        session.setEndTime(Instant.parse("2026-08-13T11:00:00Z"));
        session.setStatus(SessionStatus.ACTIVE);
        session = classroomSessionRepository.save(session);
        var sessionId = session.getId();

        var response = attendanceService.updateAttendance(
                sessionId,
                studentId,
                new UpdateAttendanceRequest(AttendanceStatus.PRESENT)
        );

        assertThat(response.status()).isEqualTo(AttendanceStatus.PRESENT);
        assertThat(response.source()).isEqualTo(AttendanceSource.MANUAL);
        assertThat(response.checkInTime()).isNotNull();

        var saved = attendanceRecordRepository
                .findBySession_IdAndStudent_Id(sessionId, studentId);

        assertThat(saved)
                .get()
                .satisfies(record -> {
                    assertThat(record.getStatus()).isEqualTo(AttendanceStatus.PRESENT);
                    assertThat(record.getSource()).isEqualTo(AttendanceSource.MANUAL);
                    assertThat(record.getCheckInTime()).isNotNull();
                });

        assertThat(attendanceService.listAttendance(sessionId))
                .hasSize(1)
                .anySatisfy(record -> {
                    assertThat(record.studentId()).isEqualTo(studentId);
                    assertThat(record.status()).isEqualTo(AttendanceStatus.PRESENT);
                    assertThat(record.source()).isEqualTo(AttendanceSource.MANUAL);
                });
    }

    @Test
    void updatingAttendanceForAStudentNotEnrolledInTheClassIsRejected() {
        CourseOffering offering = offering("SOFTENG 789");

        ClassroomSession session = new ClassroomSession();
        session.setCourse("SOFTENG 789");
        session.setCourseOffering(offering);
        session.setRoom("Room 405-460");
        session.setDate(LocalDate.of(2026, 8, 13));
        session.setStartTime(Instant.parse("2026-08-13T10:00:00Z"));
        session.setEndTime(Instant.parse("2026-08-13T11:00:00Z"));
        session.setStatus(SessionStatus.ACTIVE);
        session = classroomSessionRepository.save(session);
        var sessionId = session.getId();

        Student student = new Student();
        student.setStudentNumber("UOA-TEST-004");
        student.setUniversityEmail("uoa-test-004@aucklanduni.ac.nz");
        student.setFirstName("Not");
        student.setLastName("Enrolled");
        student.setCourse("SOFTENG 789");
        student.setSeat("A-04");
        student.setProgramme("Master of Engineering Studies");
        student.setConsentGiven(true);
        student = studentRepository.save(student);
        var studentId = student.getId();

        assertThatThrownBy(() -> attendanceService.updateAttendance(
                sessionId, studentId, new UpdateAttendanceRequest(AttendanceStatus.PRESENT)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not enrolled");
    }

    @Test
    void updatingAttendanceForAWithdrawnStudentIsRejected() {
        CourseOffering offering = offering("SOFTENG 789");

        ClassroomSession session = new ClassroomSession();
        session.setCourse("SOFTENG 789");
        session.setCourseOffering(offering);
        session.setRoom("Room 405-460");
        session.setDate(LocalDate.of(2026, 8, 13));
        session.setStartTime(Instant.parse("2026-08-13T10:00:00Z"));
        session.setEndTime(Instant.parse("2026-08-13T11:00:00Z"));
        session.setStatus(SessionStatus.ACTIVE);
        session = classroomSessionRepository.save(session);
        var sessionId = session.getId();

        Student student = new Student();
        student.setStudentNumber("UOA-TEST-005");
        student.setUniversityEmail("uoa-test-005@aucklanduni.ac.nz");
        student.setFirstName("Withdrawn");
        student.setLastName("Student");
        student.setCourse("SOFTENG 789");
        student.setSeat("A-05");
        student.setProgramme("Master of Engineering Studies");
        student.setConsentGiven(true);
        student = studentRepository.save(student);
        var studentId = student.getId();

        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourseOffering(offering);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.WITHDRAWN);
        courseEnrollmentRepository.save(enrollment);

        assertThatThrownBy(() -> attendanceService.updateAttendance(
                sessionId, studentId, new UpdateAttendanceRequest(AttendanceStatus.PRESENT)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not enrolled");
    }

    @Test
    void batchAttendanceReturnsEveryRequestedSessionAndUnknownRowsForMissingMarks() {
        CourseOffering offering = offering("SOFTENG 789");
        Student student = student("UOA-BATCH-001", "Batch", "Student");
        enrol(student, offering);

        ClassroomSession first = session(offering, LocalDate.of(2026, 8, 13));
        ClassroomSession second = session(offering, LocalDate.of(2026, 8, 20));
        attendanceService.updateAttendance(
                first.getId(), student.getId(), new UpdateAttendanceRequest(AttendanceStatus.PRESENT));

        var attendanceBySession = attendanceService.listAttendance(List.of(second.getId(), first.getId()));

        assertThat(attendanceBySession.keySet()).containsExactly(second.getId(), first.getId());
        assertThat(attendanceBySession.get(second.getId()))
                .singleElement()
                .satisfies(record -> assertThat(record.status()).isEqualTo(AttendanceStatus.UNKNOWN));
        assertThat(attendanceBySession.get(first.getId()))
                .singleElement()
                .satisfies(record -> assertThat(record.status()).isEqualTo(AttendanceStatus.PRESENT));
    }

    @Test
    void benchmarkReturnsOnlyWeightedClassAggregates() {
        CourseOffering offering = offering("SOFTENG 789");

        Student first = student("UOA-BENCH-001", "First", "Student");
        Student second = student("UOA-BENCH-002", "Second", "Student");
        enrol(first, offering);
        enrol(second, offering);

        ClassroomSession session = new ClassroomSession();
        session.setCourse("SOFTENG 789");
        session.setCourseOffering(offering);
        session.setRoom("Room 405-460");
        session.setDate(LocalDate.of(2026, 8, 13));
        session.setStartTime(Instant.parse("2026-08-13T10:00:00Z"));
        session.setEndTime(Instant.parse("2026-08-13T11:00:00Z"));
        session.setStatus(SessionStatus.COMPLETED);
        session = classroomSessionRepository.save(session);

        attendanceService.updateAttendance(
                session.getId(), first.getId(), new UpdateAttendanceRequest(AttendanceStatus.PRESENT));
        attendanceService.updateAttendance(
                session.getId(), second.getId(), new UpdateAttendanceRequest(AttendanceStatus.ABSENT));

        var benchmark = attendanceService.getAttendanceBenchmark(first.getId());

        assertThat(benchmark.overallAverageRate()).isEqualTo(50);
        assertThat(benchmark.participatingMarks()).isEqualTo(1);
        assertThat(benchmark.totalMarks()).isEqualTo(2);
        assertThat(benchmark.studentCount()).isEqualTo(2);
        assertThat(benchmark.courses())
                .singleElement()
                .satisfies(course -> {
                    assertThat(course.course()).isEqualTo("SOFTENG 789");
                    assertThat(course.averageRate()).isEqualTo(50);
                    assertThat(course.totalMarks()).isEqualTo(2);
                    assertThat(course.studentCount()).isEqualTo(2);
                });
    }

    private CourseOffering offering(String courseCode) {
        Course course = courseRepository.findByCodeIgnoreCase(courseCode)
                .orElseGet(() -> {
                    Course created = new Course();
                    created.setCode(courseCode);
                    created.setName(courseCode);
                    return courseRepository.save(created);
                });
        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode(courseCode + " 2026");
        offering.setAcademicTerm("2026 Teaching Year");
        return courseOfferingRepository.save(offering);
    }

    private Student student(String studentNumber, String firstName, String lastName) {
        Student student = new Student();
        student.setStudentNumber(studentNumber);
        student.setUniversityEmail(studentNumber.toLowerCase() + "@aucklanduni.ac.nz");
        student.setFirstName(firstName);
        student.setLastName(lastName);
        student.setCourse("SOFTENG 789");
        student.setSeat("A-01");
        student.setProgramme("Master of Engineering Studies");
        student.setConsentGiven(true);
        return studentRepository.save(student);
    }

    private ClassroomSession session(CourseOffering offering, LocalDate date) {
        ClassroomSession session = new ClassroomSession();
        session.setCourse(offering.getCourse().getCode());
        session.setCourseOffering(offering);
        session.setRoom("Room 405-460");
        session.setDate(date);
        session.setStartTime(date.atTime(10, 0).toInstant(java.time.ZoneOffset.UTC));
        session.setEndTime(date.atTime(11, 0).toInstant(java.time.ZoneOffset.UTC));
        session.setStatus(SessionStatus.COMPLETED);
        return classroomSessionRepository.save(session);
    }

    private void enrol(Student student, CourseOffering offering) {
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourseOffering(offering);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        courseEnrollmentRepository.save(enrollment);
    }
}
