package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AuthResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.LoginRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RegisterStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RegisterTeacherRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

/**
 * Issues opaque bearer tokens held in memory rather than JWTs — this is a
 * single-instance backend for a course project, so a signed token adds
 * complexity without a corresponding benefit here.
 */
@Service
public class AuthService {
    public static final String ROLE_STUDENT = "STUDENT";
    public static final String ROLE_TEACHER = "TEACHER";

    private static final Duration TOKEN_TTL = Duration.ofHours(12);

    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final CourseLookupService courseLookupService;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();

    public AuthService(
            StudentRepository studentRepository,
            TeacherRepository teacherRepository,
            CourseLookupService courseLookupService,
            CourseEnrollmentRepository courseEnrollmentRepository
    ) {
        this.studentRepository = studentRepository;
        this.teacherRepository = teacherRepository;
        this.courseLookupService = courseLookupService;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
    }

    private record Principal(String role, UUID id) {
    }

    private record Session(Principal principal, Instant expiresAt) {
    }

    @Transactional
    public AuthResponse registerStudent(RegisterStudentRequest request) {
        String studentNumber = request.studentNumber().trim();
        String email = request.universityEmail().trim();
        String courseCode = courseLookupService.normaliseCourseCode(request.course());
        String[] names = splitFullName(request.fullName().trim());

        Optional<Student> existingByNumber = studentRepository.findByStudentNumberIgnoreCase(studentNumber);
        if (existingByNumber.isPresent()) {
            Student existing = existingByNumber.get();
            if (existing.getPasswordHash() != null) {
                throw new ResponseStatusException(CONFLICT, "That student ID is already registered.");
            }
            // A teacher pre-provisioned this student (e.g. via a roster import) before they ever
            // signed up themselves — claim that record instead of bouncing them with a 409.
            // The email must match what the teacher already recorded: knowing a student number
            // alone (guessable/sequential) must not be enough to hijack someone else's account.
            if (!existing.getUniversityEmail().equalsIgnoreCase(email)) {
                throw new ResponseStatusException(CONFLICT,
                        "That student ID is already registered under a different email. "
                                + "Contact your teacher if this is a mistake.");
            }
            existing.setUniversityEmail(email);
            existing.setFirstName(names[0]);
            existing.setLastName(names[1]);
            existing.setConsentGiven(request.consentGiven());
            existing.setPasswordHash(passwordEncoder.encode(request.password()));
            // existing.version is still whatever was loaded above — if another request claimed
            // this same record in between, Hibernate's version check fails this save with an
            // optimistic-locking exception (caught by ApiExceptionHandler) instead of one claim
            // silently overwriting the other's password.
            Student saved = studentRepository.save(existing);
            enrolInCourse(saved, courseCode);
            return issueToken(ROLE_STUDENT, saved.getId(), saved.getFullName(), saved.getUniversityEmail());
        }

        if (studentRepository.findByUniversityEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "That university email is already registered.");
        }

        Student student = new Student();
        student.setStudentNumber(studentNumber);
        student.setUniversityEmail(email);
        student.setFirstName(names[0]);
        student.setLastName(names[1]);
        student.setCourse(courseCode);
        student.setSeat("Unassigned");
        student.setProgramme("Unassigned");
        student.setConsentGiven(request.consentGiven());
        student.setPasswordHash(passwordEncoder.encode(request.password()));
        student = studentRepository.save(student);
        enrolInCourse(student, courseCode);

        return issueToken(ROLE_STUDENT, student.getId(), student.getFullName(), student.getUniversityEmail());
    }

    @Transactional
    public AuthResponse registerTeacher(RegisterTeacherRequest request) {
        String staffNumber = request.staffNumber().trim();
        String email = request.email().trim();

        // Shared by every session left without a named teacher — claiming it would hand the
        // claimant full teacher access under a well-known, discoverable identity.
        if (email.equalsIgnoreCase(ClassroomSessionService.DEFAULT_TEACHER_EMAIL)) {
            throw new ResponseStatusException(CONFLICT, "That email is reserved and cannot be registered.");
        }

        Optional<Teacher> existingByEmail = teacherRepository.findByEmailIgnoreCase(email);
        if (existingByEmail.isPresent()) {
            Teacher existing = existingByEmail.get();
            if (existing.getPasswordHash() != null) {
                throw new ResponseStatusException(CONFLICT, "That email is already registered.");
            }
            // A classroom session may have referenced this teacher's real email before they ever
            // registered — claim it. (See the version comment in registerStudent for the race.)
            teacherRepository.findByStaffNumberIgnoreCase(staffNumber)
                    .filter(other -> !other.getId().equals(existing.getId()))
                    .ifPresent(other -> {
                        throw new ResponseStatusException(CONFLICT, "That staff ID is already registered.");
                    });
            existing.setStaffNumber(staffNumber);
            existing.setName(request.name().trim());
            existing.setPasswordHash(passwordEncoder.encode(request.password()));
            Teacher saved = teacherRepository.save(existing);
            return issueToken(ROLE_TEACHER, saved.getId(), saved.getName(), saved.getEmail());
        }

        if (teacherRepository.findByStaffNumberIgnoreCase(staffNumber).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "That staff ID is already registered.");
        }

        Teacher teacher = new Teacher();
        teacher.setStaffNumber(staffNumber);
        teacher.setEmail(email);
        teacher.setName(request.name().trim());
        teacher.setPasswordHash(passwordEncoder.encode(request.password()));
        teacher = teacherRepository.save(teacher);

        return issueToken(ROLE_TEACHER, teacher.getId(), teacher.getName(), teacher.getEmail());
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim();

        Optional<Student> student = studentRepository.findByUniversityEmailIgnoreCase(email);
        if (student.isPresent() && matches(request.password(), student.get().getPasswordHash())) {
            Student found = student.get();
            return issueToken(ROLE_STUDENT, found.getId(), found.getFullName(), found.getUniversityEmail());
        }

        Optional<Teacher> teacher = teacherRepository.findByEmailIgnoreCase(email);
        if (teacher.isPresent() && matches(request.password(), teacher.get().getPasswordHash())) {
            Teacher found = teacher.get();
            return issueToken(ROLE_TEACHER, found.getId(), found.getName(), found.getEmail());
        }

        throw new ResponseStatusException(UNAUTHORIZED, "Incorrect email or password.");
    }

    @Transactional(readOnly = true)
    public AuthResponse me(String token) {
        Principal principal = resolve(token);
        if (principal == null) {
            throw new ResponseStatusException(UNAUTHORIZED, "Your session has expired. Please sign in again.");
        }
        if (principal.role().equals(ROLE_STUDENT)) {
            Student student = studentRepository.findById(principal.id())
                    .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Account no longer exists."));
            return new AuthResponse(token, ROLE_STUDENT, student.getId(), student.getFullName(), student.getUniversityEmail());
        }
        Teacher teacher = teacherRepository.findById(principal.id())
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Account no longer exists."));
        return new AuthResponse(token, ROLE_TEACHER, teacher.getId(), teacher.getName(), teacher.getEmail());
    }

    public void logout(String token) {
        sessions.remove(token);
    }

    /** Allows a teacher to access any student's records, or a student to access only their own. */
    public void requireSelfOrTeacher(String authorizationHeader, UUID studentId) {
        Principal principal = resolvePrincipalOrThrow(authorizationHeader);
        if (principal.role().equals(ROLE_TEACHER)) {
            return;
        }
        if (principal.role().equals(ROLE_STUDENT) && principal.id().equals(studentId)) {
            return;
        }
        throw new ResponseStatusException(FORBIDDEN, "You can only access your own records.");
    }

    /** Gates teacher-console-only endpoints (roster management, session lifecycle, attendance edits). */
    public void requireTeacher(String authorizationHeader) {
        Principal principal = resolvePrincipalOrThrow(authorizationHeader);
        if (!principal.role().equals(ROLE_TEACHER)) {
            throw new ResponseStatusException(FORBIDDEN, "Only teachers can do this.");
        }
    }

    /** Shared by requireSelfOrTeacher/requireTeacher: resolve the token, or 401 if it's missing/invalid. */
    private Principal resolvePrincipalOrThrow(String authorizationHeader) {
        Principal principal = resolve(extractToken(authorizationHeader));
        if (principal == null) {
            throw new ResponseStatusException(UNAUTHORIZED, "Sign in required.");
        }
        return principal;
    }

    /** Shared bearer-token parsing so controllers don't each reimplement it. */
    public String extractToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(UNAUTHORIZED, "Sign in required.");
        }
        return authorizationHeader.substring("Bearer ".length()).trim();
    }

    private Principal resolve(String token) {
        Session session = sessions.get(token);
        if (session == null) {
            return null;
        }
        if (Instant.now().isAfter(session.expiresAt())) {
            sessions.remove(token);
            return null;
        }
        return session.principal();
    }

    private boolean matches(String rawPassword, String storedHash) {
        return storedHash != null && passwordEncoder.matches(rawPassword, storedHash);
    }

    /** Mirrors StudentService's enrolment bootstrapping so a self-registered student is actually rosterable. */
    private void enrolInCourse(Student student, String courseCode) {
        if (courseEnrollmentRepository.existsByStudent_IdAndCourse_CodeIgnoreCase(student.getId(), courseCode)) {
            return;
        }
        Course course = courseLookupService.findOrCreateCourse(courseCode);
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourse(course);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.ACTIVE);
        courseEnrollmentRepository.save(enrollment);
    }

    /** Student records keep separate first/last name columns; self-registration only collects one field. */
    private String[] splitFullName(String fullName) {
        int spaceIndex = fullName.indexOf(' ');
        if (spaceIndex < 0) {
            return new String[] {fullName, ""};
        }
        return new String[] {fullName.substring(0, spaceIndex), fullName.substring(spaceIndex + 1).trim()};
    }

    private AuthResponse issueToken(String role, UUID id, String name, String email) {
        Instant now = Instant.now();
        sessions.entrySet().removeIf(entry -> now.isAfter(entry.getValue().expiresAt()));

        String token = UUID.randomUUID().toString();
        sessions.put(token, new Session(new Principal(role, id), now.plus(TOKEN_TTL)));
        return new AuthResponse(token, role, id, name, email);
    }
}
