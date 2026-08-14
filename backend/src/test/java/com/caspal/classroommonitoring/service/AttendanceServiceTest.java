package com.caspal.classroommonitoring.service;

import com.caspal.classroommonitoring.dto.UpdateAttendanceRequest;
import com.caspal.classroommonitoring.entity.AttendanceRecord.AttendanceSource;
import com.caspal.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import com.caspal.classroommonitoring.entity.ClassroomSession;
import com.caspal.classroommonitoring.entity.ClassroomSession.SessionStatus;
import com.caspal.classroommonitoring.entity.Course;
import com.caspal.classroommonitoring.entity.CourseEnrollment;
import com.caspal.classroommonitoring.entity.Student;
import com.caspal.classroommonitoring.repository.AttendanceRecordRepository;
import com.caspal.classroommonitoring.repository.ClassroomSessionRepository;
import com.caspal.classroommonitoring.repository.CourseEnrollmentRepository;
import com.caspal.classroommonitoring.repository.CourseRepository;
import com.caspal.classroommonitoring.repository.StudentRepository;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

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
    private CourseEnrollmentRepository courseEnrollmentRepository;

    @Autowired
    private StudentRepository studentRepository;

    @BeforeEach
    void cleanDatabase() {
        attendanceRecordRepository.deleteAll();
        courseEnrollmentRepository.deleteAll();
        studentRepository.deleteAll();
        classroomSessionRepository.deleteAll();
        courseRepository.deleteAll();
    }

    @Test
    void manualAttendanceUpdateIsPersisted() {
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
        enrol(student, "SOFTENG 789");
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
        enrol(otherStudent, "COMPSCI 730");

        Student legacyStudent = new Student();
        legacyStudent.setStudentNumber("UOA-TEST-003");
        legacyStudent.setUniversityEmail("uoa-test-003@aucklanduni.ac.nz");
        legacyStudent.setFirstName("Legacy");
        legacyStudent.setLastName("Student");
        legacyStudent.setCourse("SOFTENG 789");
        legacyStudent.setSeat("A-03");
        legacyStudent.setProgramme("Master of Engineering Studies");
        legacyStudent.setConsentGiven(true);
        legacyStudent = studentRepository.save(legacyStudent);
        var legacyStudentId = legacyStudent.getId();

        ClassroomSession session = new ClassroomSession();
        session.setCourse("SOFTENG 789");
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
                .hasSize(2)
                .anySatisfy(record -> {
                    assertThat(record.studentId()).isEqualTo(studentId);
                    assertThat(record.status()).isEqualTo(AttendanceStatus.PRESENT);
                    assertThat(record.source()).isEqualTo(AttendanceSource.MANUAL);
                })
                .anySatisfy(record -> {
                    assertThat(record.studentId()).isEqualTo(legacyStudentId);
                    assertThat(record.status()).isEqualTo(AttendanceStatus.UNKNOWN);
                });
    }

    private void enrol(Student student, String courseCode) {
        Course course = courseRepository.findByCodeIgnoreCase(courseCode)
                .orElseGet(() -> {
                    Course created = new Course();
                    created.setCode(courseCode);
                    created.setName(courseCode);
                    return courseRepository.save(created);
                });
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourse(course);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        courseEnrollmentRepository.save(enrollment);
    }
}
