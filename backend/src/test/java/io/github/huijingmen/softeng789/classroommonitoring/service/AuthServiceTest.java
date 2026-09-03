package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AuthResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.LoginRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:auth-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class AuthServiceTest {
    private static final String PASSWORD = "correct-horse-battery";
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Autowired
    private AuthService authService;

    @Autowired
    private SessionAuthService sessionAuthService;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private StudentRepository studentRepository;

    @BeforeEach
    void cleanDatabase() {
        teacherRepository.deleteAll();
        studentRepository.deleteAll();
    }

    private Teacher saveTeacher(String email, String staffNumber, String status) {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber(staffNumber);
        teacher.setEmail(email);
        teacher.setName("Dr. Dana Kessler");
        teacher.setPasswordHash(passwordEncoder.encode(PASSWORD));
        teacher.setStatus(status);
        return teacherRepository.save(teacher);
    }

    private Student saveStudent(String email, String studentNumber, String status) {
        Student student = new Student();
        student.setStudentNumber(studentNumber);
        student.setUniversityEmail(email);
        student.setFirstName("With");
        student.setLastName("Draw");
        student.setCourse("SOFTENG 789");
        student.setSeat("B-01");
        student.setProgramme("Master of Engineering Studies");
        student.setPasswordHash(passwordEncoder.encode(PASSWORD));
        student.setStatus(status);
        return studentRepository.save(student);
    }

    @Test
    void activeTeacherCanLogIn() {
        saveTeacher("d.kessler@auckland.ac.nz", "UOA-DKESSLER", "ACTIVE");

        AuthResponse response = authService.login(new LoginRequest("d.kessler@auckland.ac.nz", PASSWORD));

        assertThat(response.token()).isNotBlank();
        assertThat(response.role()).isEqualTo(SessionAuthService.ROLE_TEACHER);
    }

    @Test
    void deactivatedTeacherCannotLogInEvenWithTheCorrectPassword() {
        saveTeacher("d.kessler@auckland.ac.nz", "UOA-DKESSLER", "DEACTIVATED");

        assertThatThrownBy(() -> authService.login(new LoginRequest("d.kessler@auckland.ac.nz", PASSWORD)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("deactivated");
    }

    @Test
    void deactivatingAnAlreadyLoggedInTeacherEndsTheirSessionImmediately() {
        Teacher teacher = saveTeacher("d.kessler@auckland.ac.nz", "UOA-DKESSLER", "ACTIVE");
        AuthResponse loggedIn = authService.login(new LoginRequest("d.kessler@auckland.ac.nz", PASSWORD));

        // Confirms the token is live before revocation, so the assertion below actually exercises
        // revokeSessionsFor rather than passing on a token that never worked in the first place.
        assertThat(authService.me(loggedIn.token()).id()).isEqualTo(teacher.getId());

        sessionAuthService.revokeSessionsFor(teacher.getId());

        assertThatThrownBy(() -> authService.me(loggedIn.token()))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void meRejectsATokenWhoseAccountBecameDeactivatedAfterLogin() {
        Teacher teacher = saveTeacher("d.kessler@auckland.ac.nz", "UOA-DKESSLER", "ACTIVE");
        AuthResponse loggedIn = authService.login(new LoginRequest("d.kessler@auckland.ac.nz", PASSWORD));

        teacher.setStatus("DEACTIVATED");
        teacherRepository.save(teacher);

        assertThatThrownBy(() -> authService.me(loggedIn.token()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("deactivated");
    }

    @Test
    void withdrawnStudentCannotLogInEvenWithTheCorrectPassword() {
        saveStudent("with.draw@aucklanduni.ac.nz", "UOA-WITHDRAW", "WITHDRAWN");

        assertThatThrownBy(() -> authService.login(new LoginRequest("with.draw@aucklanduni.ac.nz", PASSWORD)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("withdrawn");
    }

    @Test
    void withdrawingAnAlreadyLoggedInStudentEndsTheirSessionImmediately() {
        Student student = saveStudent("with.draw@aucklanduni.ac.nz", "UOA-WITHDRAW", "ACTIVE");
        AuthResponse loggedIn = authService.login(new LoginRequest("with.draw@aucklanduni.ac.nz", PASSWORD));

        assertThat(authService.me(loggedIn.token()).id()).isEqualTo(student.getId());

        sessionAuthService.revokeSessionsFor(student.getId());

        assertThatThrownBy(() -> authService.me(loggedIn.token()))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void meRejectsATokenWhoseStudentAccountBecameWithdrawnAfterLogin() {
        Student student = saveStudent("with.draw@aucklanduni.ac.nz", "UOA-WITHDRAW", "ACTIVE");
        AuthResponse loggedIn = authService.login(new LoginRequest("with.draw@aucklanduni.ac.nz", PASSWORD));

        student.setStatus("WITHDRAWN");
        studentRepository.save(student);

        assertThatThrownBy(() -> authService.me(loggedIn.token()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("withdrawn");
    }
}
