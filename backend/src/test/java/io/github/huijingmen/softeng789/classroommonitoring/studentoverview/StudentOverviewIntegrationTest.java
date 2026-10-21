package io.github.huijingmen.softeng789.classroommonitoring.studentoverview;

import static io.github.huijingmen.softeng789.classroommonitoring.auth.BrowserTestSession.browserSession;

import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:student-overview-integration;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
        "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
@AutoConfigureMockMvc
@Transactional
class StudentOverviewIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private SessionAuthService auth;
    @Autowired private StudentRepository students;
    @Autowired private CourseRepository courses;
    @Autowired private CourseOfferingRepository offerings;
    @Autowired private CourseEnrollmentRepository enrollments;
    @Autowired private ClassroomSessionRepository sessions;
    @Autowired private TeacherRepository teachers;

    @Test
    void classQueryExcludesOtherClassesPendingInactiveAndWithdrawnStudents() throws Exception {
        var target = offering("TARGET"); var other = offering("OTHER");
        var ana = student("Ana", "APPROVED", "ACTIVE"); enroll(ana, target, CourseEnrollment.EnrollmentStatus.ACTIVE);
        enroll(student("Ben", "APPROVED", "ACTIVE"), other, CourseEnrollment.EnrollmentStatus.ACTIVE);
        enroll(student("Pending", "PENDING", "ACTIVE"), target, CourseEnrollment.EnrollmentStatus.ACTIVE);
        enroll(student("Inactive", "APPROVED", "WITHDRAWN"), target, CourseEnrollment.EnrollmentStatus.ACTIVE);
        enroll(student("Withdrawn", "APPROVED", "ACTIVE"), target, CourseEnrollment.EnrollmentStatus.WITHDRAWN);
        assertThat(students.findActiveStudentsInCourseOffering(target.getId())).extracting(Student::getId)
                .containsExactly(ana.getId());
        mvc.perform(get("/api/admin/student-overview").param("courseOfferingId", target.getId().toString())
                        .param("weekStart", "2026-10-12").with(browserSession(token("ADMIN"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accounts.length()").value(1))
                .andExpect(jsonPath("$.accounts[0].studentId").value(ana.getId().toString()))
                .andExpect(jsonPath("$.summary.totalStudents").value(1))
                .andExpect(jsonPath("$.reconciliations[0].rows.length()").value(1));
    }

    @Test
    void actualAttendanceWriteRefreshesTheSelectedLessonAndWithdrawalInvalidatesIt() throws Exception {
        var target = offering("REFRESH"); var ana = student("Ana", "APPROVED", "ACTIVE");
        var enrollment = enroll(ana, target, CourseEnrollment.EnrollmentStatus.ACTIVE);
        var session = lesson(target);
        String admin = token("ADMIN");
        mvc.perform(put("/api/sessions/{session}/attendance/{student}", session.getId(), ana.getId())
                        .with(browserSession(admin)).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PRESENT\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/admin/student-overview/students/{student}", ana.getId())
                        .param("courseOfferingId", target.getId().toString()).param("weekStart", "2026-10-12")
                        .with(browserSession(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accounts.length()").value(1))
                .andExpect(jsonPath("$.reconciliations[0].rows[0].cells[0].attendanceStatus").value("PRESENT"));
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.WITHDRAWN); enrollments.saveAndFlush(enrollment);
        mvc.perform(get("/api/admin/student-overview/students/{student}", ana.getId())
                        .param("courseOfferingId", target.getId().toString()).param("weekStart", "2026-10-12")
                        .with(browserSession(admin))).andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/student-overview").param("courseOfferingId", target.getId().toString())
                        .param("weekStart", "2026-10-12").with(browserSession(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary.totalStudents").value(0))
                .andExpect(jsonPath("$.accounts.length()").value(0));
    }

    @Test
    void httpBoundaryRejectsAnonymousTeacherStudentAndInvalidPagination() throws Exception {
        mvc.perform(get("/api/admin/student-overview").param("weekStart", "2026-10-12"))
                .andExpect(status().isUnauthorized());
        for (String role : new String[]{"TEACHER", "STUDENT"}) {
            String header = token(role);
            mvc.perform(get("/api/admin/student-overview").param("weekStart", "2026-10-12").with(browserSession(header)))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/api/admin/student-overview/students/{student}", UUID.randomUUID())
                            .param("courseOfferingId", UUID.randomUUID().toString()).param("weekStart", "2026-10-12")
                            .with(browserSession(header))).andExpect(status().isForbidden());
        }
        mvc.perform(get("/api/admin/student-overview").param("weekStart", "2026-10-12").param("size", "101")
                        .with(browserSession(token("ADMIN")))).andExpect(status().isBadRequest());
    }

    private String token(String role) {
        UUID id = UUID.randomUUID();
        if ("STUDENT".equals(role)) id = student("Gate-" + id, "APPROVED", "ACTIVE").getId();
        if (!"STUDENT".equals(role)) {
            Teacher teacher = new Teacher(); teacher.setStaffNumber("TEST-" + id); teacher.setEmail(id + "@example.test");
            teacher.setName("Test"); teacher.setRole(role); id = teachers.save(teacher).getId();
        }
        return "Bearer " + auth.issueToken(role, id, "Test", "test@example.test", "APPROVED").token();
    }

    private CourseOffering offering(String code) {
        Course course = new Course(); course.setCode(code); course.setName(code); courses.save(course);
        CourseOffering offering = new CourseOffering(); offering.setCourse(course); offering.setOfferingCode(code + "-2026");
        offering.setAcademicTerm("2026"); offering.setDefaultPrice(BigDecimal.valueOf(100)); return offerings.save(offering);
    }

    private Student student(String name, String approval, String status) {
        Student student = new Student(); student.setStudentNumber(name + "-01"); student.setUniversityEmail(name + "@example.test");
        student.setFirstName(name); student.setLastName("Example"); student.setCourse("Test"); student.setSeat("A1");
        student.setProgramme("Test"); student.setApprovalStatus(approval); student.setStatus(status); return students.save(student);
    }

    private CourseEnrollment enroll(Student student, CourseOffering offering, CourseEnrollment.EnrollmentStatus status) {
        CourseEnrollment enrollment = new CourseEnrollment(); enrollment.setStudent(student); enrollment.setCourseOffering(offering);
        enrollment.setStatus(status); enrollment.setEnrolledAt(Instant.parse("2026-01-01T00:00:00Z")); return enrollments.save(enrollment);
    }

    private ClassroomSession lesson(CourseOffering offering) {
        ClassroomSession session = new ClassroomSession(); session.setCourse("Test"); session.setCourseOffering(offering); session.setRoom("101");
        session.setDate(LocalDate.parse("2026-10-14")); session.setStartTime(Instant.parse("2026-10-14T10:00:00Z"));
        session.setEndTime(Instant.parse("2026-10-14T11:00:00Z")); session.setStatus(ClassroomSession.SessionStatus.COMPLETED);
        return sessions.save(session);
    }
}
