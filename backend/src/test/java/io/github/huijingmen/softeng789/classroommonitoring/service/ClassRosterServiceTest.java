package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AddClassStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:class-roster-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class ClassRosterServiceTest {
    @Autowired
    private ClassRosterService classRosterService;

    @Autowired
    private AdminClassService adminClassService;

    @Autowired
    private CourseEnrollmentRepository courseEnrollmentRepository;

    @Autowired
    private CourseOfferingRepository courseOfferingRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @BeforeEach
    void cleanDatabase() {
        courseEnrollmentRepository.deleteAll();
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
        studentRepository.deleteAll();
        teacherRepository.deleteAll();
    }

    private Student saveStudent(String suffix, String status) {
        Student student = new Student();
        student.setStudentNumber("UOA-ROSTER-" + suffix);
        student.setUniversityEmail("roster-" + suffix + "@aucklanduni.ac.nz");
        student.setFirstName("Roster");
        student.setLastName("Student " + suffix);
        student.setCourse("SOFTENG 789");
        student.setSeat("B-01");
        student.setProgramme("Master of Engineering Studies");
        student.setStatus(status);
        return studentRepository.save(student);
    }

    private ClassResponse createClass(String courseCode) {
        return adminClassService.createClass(new CreateClassRequest(courseCode, "2026 Teaching Year", List.of()));
    }

    @Test
    void addStudentRejectsAWithdrawnStudent() {
        Student student = saveStudent("1", "WITHDRAWN");
        ClassResponse offering = createClass("SOFTENG 789");

        assertThatThrownBy(() -> classRosterService.addStudent(
                offering.id(), new AddClassStudentRequest(student.getId())))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("withdrawn");
    }

    @Test
    void removingThenReAddingTheSameStudentReusesTheSameEnrollmentRow() {
        Student student = saveStudent("2", "ACTIVE");
        ClassResponse offering = createClass("SOFTENG 789");

        classRosterService.addStudent(offering.id(), new AddClassStudentRequest(student.getId()));
        CourseEnrollment firstEnrollment = courseEnrollmentRepository
                .findByStudent_IdAndCourseOffering_Id(student.getId(), offering.id())
                .orElseThrow();
        UUID enrollmentId = firstEnrollment.getId();

        classRosterService.removeStudent(offering.id(), student.getId());
        assertThat(courseEnrollmentRepository.findById(enrollmentId).orElseThrow().getStatus())
                .isEqualTo(CourseEnrollment.EnrollmentStatus.WITHDRAWN);

        classRosterService.addStudent(offering.id(), new AddClassStudentRequest(student.getId()));
        CourseEnrollment reactivated = courseEnrollmentRepository.findById(enrollmentId).orElseThrow();

        assertThat(reactivated.getStatus()).isEqualTo(CourseEnrollment.EnrollmentStatus.ACTIVE);
        assertThat(courseEnrollmentRepository.findByStudent_IdAndCourseOffering_Id(student.getId(), offering.id()))
                .get()
                .extracting(CourseEnrollment::getId)
                .isEqualTo(enrollmentId);
    }

    @Test
    void transferStudentMovesAtomicallyBetweenClasses() {
        Student student = saveStudent("3", "ACTIVE");
        ClassResponse classA = createClass("SOFTENG 789");
        ClassResponse classB = createClass("COMPSCI 730");
        classRosterService.addStudent(classA.id(), new AddClassStudentRequest(student.getId()));

        classRosterService.transferStudent(student.getId(), classA.id(), classB.id());

        assertThat(classRosterService.listStudents(classA.id())).isEmpty();
        assertThat(classRosterService.listStudents(classB.id()))
                .extracting("id")
                .containsExactly(student.getId());
    }

    @Test
    void transferStudentRejectsTransferringToTheSameClass() {
        Student student = saveStudent("4", "ACTIVE");
        ClassResponse offering = createClass("SOFTENG 789");
        classRosterService.addStudent(offering.id(), new AddClassStudentRequest(student.getId()));

        assertThatThrownBy(() -> classRosterService.transferStudent(student.getId(), offering.id(), offering.id()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("must be different");
    }

    @Test
    void teacherCanReadOnlyTheRosterForAnAssignedOffering() {
        Teacher assignedTeacher = saveTeacher("assigned");
        Teacher otherTeacher = saveTeacher("other");
        Student student = saveStudent("5", "ACTIVE");
        ClassResponse offering = adminClassService.createClass(new CreateClassRequest(
                "SOFTENG 789", "2026 Teaching Year", List.of(assignedTeacher.getId())));
        classRosterService.addStudent(offering.id(), new AddClassStudentRequest(student.getId()));

        assertThat(classRosterService.listStudents(offering.id(), assignedTeacher.getId()))
                .extracting("id")
                .containsExactly(student.getId());
        assertThatThrownBy(() -> classRosterService.listStudents(offering.id(), otherTeacher.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("own classes");
    }

    private Teacher saveTeacher(String suffix) {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-ROSTER-TEACHER-" + suffix);
        teacher.setEmail("roster-teacher-" + suffix + "@auckland.ac.nz");
        teacher.setName("Roster Teacher " + suffix);
        teacher.setRole("TEACHER");
        return teacherRepository.save(teacher);
    }
}
