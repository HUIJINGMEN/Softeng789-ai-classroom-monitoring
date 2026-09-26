package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.StudentLevel;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:student-directory-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class StudentDirectoryServiceTest {
    @Autowired
    private StudentDirectoryService directoryService;

    @Autowired
    private StudentService studentService;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private ClassroomSessionRepository classroomSessionRepository;

    @Autowired
    private CourseEnrollmentRepository courseEnrollmentRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private CourseOfferingRepository courseOfferingRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @BeforeEach
    void cleanDatabase() {
        attendanceRecordRepository.deleteAll();
        classroomSessionRepository.deleteAll();
        courseEnrollmentRepository.deleteAll();
        studentRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
        teacherRepository.deleteAll();
    }

    @Test
    void attendanceSortIsGlobalAndKeepsStudentsWithoutRecordsLast() {
        Teacher admin = createAdmin();
        Student low = createStudent("DIR-LOW", "Ava", "Able", StudentLevel.LEVEL_1);
        Student high = createStudent("DIR-HIGH", "Bea", "Young", StudentLevel.LEVEL_2);
        Student noRecords = createStudent("DIR-NONE", "Cara", "Zed", StudentLevel.LEVEL_3);
        List<ClassroomSession> sessions = createSessions();

        saveAttendance(low, sessions.get(0), AttendanceStatus.PRESENT);
        saveAttendance(low, sessions.get(1), AttendanceStatus.ABSENT);
        saveAttendance(high, sessions.get(0), AttendanceStatus.PRESENT);
        saveAttendance(high, sessions.get(1), AttendanceStatus.LATE);

        var firstPage = directoryService.list(
                admin.getId(), 0, 2, null, null, null, "attendance", "asc");
        var secondPage = directoryService.list(
                admin.getId(), 1, 2, null, null, null, "attendance", "asc");
        var descending = directoryService.list(
                admin.getId(), 0, 10, null, null, null, "attendance", "desc");

        assertThat(firstPage.totalItems()).isEqualTo(3);
        assertThat(firstPage.items()).extracting(item -> item.student().studentNumber())
                .containsExactly("DIR-LOW", "DIR-HIGH");
        assertThat(firstPage.items()).extracting("attendanceRate").containsExactly(50, 100);
        assertThat(secondPage.items()).extracting(item -> item.student().id())
                .containsExactly(noRecords.getId());
        assertThat(secondPage.items()).extracting("attendanceRate").containsExactly((Integer) null);
        assertThat(descending.items()).extracting(item -> item.student().studentNumber())
                .containsExactly("DIR-HIGH", "DIR-LOW", "DIR-NONE");
    }

    @Test
    void searchAndLevelFiltersAreAppliedBeforePagination() {
        Teacher admin = createAdmin();
        createStudent("DIR-ALPHA", "Alpha", "One", StudentLevel.LEVEL_1);
        createStudent("DIR-BETA", "Beta", "Two", StudentLevel.LEVEL_2);
        createStudent("DIR-GAMMA", "Gamma", "Three", StudentLevel.LEVEL_2);

        var result = directoryService.list(
                admin.getId(), 0, 8, "gamma", null, "LEVEL_2", "name", "asc");

        assertThat(result.totalItems()).isEqualTo(1);
        assertThat(result.items()).extracting(item -> item.student().studentNumber())
                .containsExactly("DIR-GAMMA");
    }

    @Test
    void teacherAttendanceRateOnlyUsesClassesTheyTeach() {
        Teacher admin = createAdmin();
        Teacher teacher = createTeacher();
        Student student = createStudent("DIR-SCOPED", "Scoped", "Student", StudentLevel.LEVEL_1);
        CourseOffering ownedOffering = createOffering("COMPSCI 335", "DIR-OWNED", teacher);
        CourseOffering otherOffering = createOffering("COMPSCI 726", "DIR-OTHER", null);
        enrol(student, ownedOffering);
        enrol(student, otherOffering);

        ClassroomSession ownedSession = classroomSessionRepository.save(
                session(ownedOffering, LocalDate.of(2026, 9, 1), "2026-09-01T00:00:00Z")
        );
        ClassroomSession otherSession = classroomSessionRepository.save(
                session(otherOffering, LocalDate.of(2026, 9, 2), "2026-09-02T00:00:00Z")
        );
        saveAttendance(student, ownedSession, AttendanceStatus.PRESENT);
        saveAttendance(student, otherSession, AttendanceStatus.ABSENT);

        var teacherView = directoryService.list(
                teacher.getId(), 0, 8, null, null, null, "attendance", "asc");
        var adminView = directoryService.list(
                admin.getId(), 0, 8, "DIR-SCOPED", null, null, "attendance", "asc");

        assertThat(teacherView.items()).extracting("attendanceRate").containsExactly(100);
        assertThat(adminView.items()).extracting("attendanceRate").containsExactly(50);
    }

    private Teacher createAdmin() {
        Teacher admin = new Teacher();
        admin.setStaffNumber("DIR-ADMIN");
        admin.setEmail("directory-admin@auckland.ac.nz");
        admin.setName("Directory Admin");
        admin.setRole("ADMIN");
        return teacherRepository.save(admin);
    }

    private Teacher createTeacher() {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("DIR-TEACHER");
        teacher.setEmail("directory-teacher@auckland.ac.nz");
        teacher.setName("Directory Teacher");
        teacher.setRole("TEACHER");
        return teacherRepository.save(teacher);
    }

    private Student createStudent(
            String studentNumber,
            String firstName,
            String lastName,
            StudentLevel level
    ) {
        var created = studentService.createStudent(new CreateStudentRequest(
                studentNumber,
                studentNumber.toLowerCase() + "@aucklanduni.ac.nz",
                firstName,
                lastName,
                "COMPSCI 335",
                List.of("COMPSCI 335"),
                "A-01",
                "Computer Science",
                true,
                level
        ));
        return studentRepository.findById(created.id()).orElseThrow();
    }

    private List<ClassroomSession> createSessions() {
        Course course = new Course();
        course.setCode("COMPSCI 335");
        course.setName("Computer Science");
        course = courseRepository.save(course);

        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode("COMPSCI 335 2026");
        offering.setAcademicTerm("2026 Teaching Year");
        offering = courseOfferingRepository.save(offering);

        ClassroomSession first = session(offering, LocalDate.of(2026, 9, 1), "2026-09-01T00:00:00Z");
        ClassroomSession second = session(offering, LocalDate.of(2026, 9, 8), "2026-09-08T00:00:00Z");
        return List.of(classroomSessionRepository.save(first), classroomSessionRepository.save(second));
    }

    private CourseOffering createOffering(String courseCode, String offeringCode, Teacher teacher) {
        Course course = new Course();
        course.setCode(courseCode);
        course.setName(courseCode);
        course = courseRepository.save(course);

        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode(offeringCode);
        offering.setAcademicTerm("2026 Teaching Year");
        if (teacher != null) {
            offering.getTeachers().add(teacher);
        }
        return courseOfferingRepository.save(offering);
    }

    private void enrol(Student student, CourseOffering offering) {
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourseOffering(offering);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        courseEnrollmentRepository.save(enrollment);
    }

    private ClassroomSession session(CourseOffering offering, LocalDate date, String start) {
        ClassroomSession session = new ClassroomSession();
        session.setCourse("COMPSCI 335");
        session.setCourseOffering(offering);
        session.setRoom("City · 303-G14");
        session.setDate(date);
        session.setStartTime(Instant.parse(start));
        session.setEndTime(Instant.parse(start).plusSeconds(3600));
        session.setStatus(SessionStatus.COMPLETED);
        return session;
    }

    private void saveAttendance(
            Student student,
            ClassroomSession session,
            AttendanceStatus status
    ) {
        AttendanceRecord record = new AttendanceRecord();
        record.setStudent(student);
        record.setSession(session);
        record.setStatus(status);
        attendanceRecordRepository.save(record);
    }
}
