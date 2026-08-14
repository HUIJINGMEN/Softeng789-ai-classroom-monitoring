package com.caspal.classroommonitoring.service;

import com.caspal.classroommonitoring.dto.CreateStudentRequest;
import com.caspal.classroommonitoring.repository.AttendanceRecordRepository;
import com.caspal.classroommonitoring.repository.CourseEnrollmentRepository;
import com.caspal.classroommonitoring.repository.CourseRepository;
import com.caspal.classroommonitoring.repository.FaceEnrollmentRepository;
import com.caspal.classroommonitoring.repository.StudentRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:student-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class StudentServiceTest {
    @Autowired
    private StudentService studentService;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private FaceEnrollmentRepository faceEnrollmentRepository;

    @Autowired
    private CourseEnrollmentRepository courseEnrollmentRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private StudentRepository studentRepository;

    @BeforeEach
    void cleanDatabase() {
        attendanceRecordRepository.deleteAll();
        faceEnrollmentRepository.deleteAll();
        courseEnrollmentRepository.deleteAll();
        studentRepository.deleteAll();
        courseRepository.deleteAll();
    }

    @Test
    void studentCanBeEnrolledInMultipleCourses() {
        var created = studentService.createStudent(new CreateStudentRequest(
                "UOA-MULTI-001",
                "uoa-multi-001@aucklanduni.ac.nz",
                "Multi",
                "Course",
                "SOFTENG 789",
                List.of("SOFTENG 789", "COMPSCI 730"),
                "B-04",
                "Master of Engineering Studies",
                true
        ));

        assertThat(created.course()).isEqualTo("SOFTENG 789");
        assertThat(created.courses()).containsExactly("SOFTENG 789", "COMPSCI 730");
        assertThat(courseRepository.findByCodeIgnoreCase("SOFTENG 789")).isPresent();
        assertThat(courseRepository.findByCodeIgnoreCase("COMPSCI 730")).isPresent();
        assertThat(courseEnrollmentRepository.findByStudent_IdOrderByCourse_CodeAsc(created.id()))
                .hasSize(2);
    }
}
