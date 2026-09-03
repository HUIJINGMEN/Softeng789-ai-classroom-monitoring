package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AddClassTeacherRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
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
        "spring.datasource.url=jdbc:h2:mem:admin-class-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class AdminClassServiceTest {
    @Autowired
    private AdminClassService adminClassService;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private CourseOfferingRepository courseOfferingRepository;

    @Autowired
    private CourseRepository courseRepository;

    @BeforeEach
    void cleanDatabase() {
        courseOfferingRepository.deleteAll();
        courseRepository.deleteAll();
        teacherRepository.deleteAll();
    }

    private Teacher saveTeacher(String status) {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("UOA-DKESSLER");
        teacher.setEmail("d.kessler@auckland.ac.nz");
        teacher.setName("Dr. Dana Kessler");
        teacher.setStatus(status);
        return teacherRepository.save(teacher);
    }

    @Test
    void addTeacherRejectsADeactivatedTeacher() {
        Teacher teacher = saveTeacher("DEACTIVATED");
        ClassResponse offering = adminClassService.createClass(
                new CreateClassRequest("SOFTENG 789", "2026 Teaching Year", List.of()));

        assertThatThrownBy(() -> adminClassService.addTeacher(
                offering.id(), new AddClassTeacherRequest(teacher.getId())))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("deactivated");
    }

    @Test
    void createClassRejectsADeactivatedTeacherInTheInitialList() {
        Teacher teacher = saveTeacher("DEACTIVATED");

        assertThatThrownBy(() -> adminClassService.createClass(
                new CreateClassRequest("SOFTENG 789", "2026 Teaching Year", List.of(teacher.getId()))))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("deactivated");
    }

    @Test
    void addTeacherAcceptsAnActiveTeacher() {
        Teacher teacher = saveTeacher("ACTIVE");
        ClassResponse offering = adminClassService.createClass(
                new CreateClassRequest("SOFTENG 789", "2026 Teaching Year", List.of()));

        ClassResponse updated = adminClassService.addTeacher(
                offering.id(), new AddClassTeacherRequest(teacher.getId()));

        assertThat(updated.teachers()).extracting("id").containsExactly(teacher.getId());
    }
}
