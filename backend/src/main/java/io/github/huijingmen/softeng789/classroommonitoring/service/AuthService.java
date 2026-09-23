package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AuthResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.LoginRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RegisterStudentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.RegisterTeacherRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

/**
 * Registration, login and whoami — issues opaque bearer tokens (via {@link SessionAuthService})
 * held in memory rather than JWTs, since this is a single-instance backend for a course project
 * and a signed token adds complexity without a corresponding benefit here. Session lifecycle and
 * every "who is allowed to do this" gate method live in {@link SessionAuthService} instead —
 * nearly every controller only needs those gates, not registration/login.
 */
@Service
public class AuthService {
    private static final String STATUS_DEACTIVATED = "DEACTIVATED";
    private static final String STATUS_WITHDRAWN = "WITHDRAWN";

    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final CourseLookupService courseLookupService;
    private final CourseOfferingRepository courseOfferingRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final FaceEnrollmentService faceEnrollmentService;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SessionAuthService sessionAuthService;

    public AuthService(
            StudentRepository studentRepository,
            TeacherRepository teacherRepository,
            CourseLookupService courseLookupService,
            CourseOfferingRepository courseOfferingRepository,
            CourseEnrollmentRepository courseEnrollmentRepository,
            FaceEnrollmentService faceEnrollmentService,
            SessionAuthService sessionAuthService
    ) {
        this.studentRepository = studentRepository;
        this.teacherRepository = teacherRepository;
        this.courseLookupService = courseLookupService;
        this.courseOfferingRepository = courseOfferingRepository;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.faceEnrollmentService = faceEnrollmentService;
        this.sessionAuthService = sessionAuthService;
    }

    @Transactional
    public AuthResponse registerStudent(
            RegisterStudentRequest request,
            String captureMetadata,
            List<MultipartFile> captureImages
    ) {
        String studentNumber = request.studentNumber().trim();
        String email = request.universityEmail().trim();
        List<CourseOffering> selectedClasses = resolveSelectedClasses(request.classOfferingIds());
        String courseCode = courseLookupService.normaliseCourseCode(selectedClasses.get(0).getCourse().getCode());
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
            existing.setLevel(request.level());
            existing.setPasswordHash(passwordEncoder.encode(request.password()));
            // existing.version is still whatever was loaded above — if another request claimed
            // this same record in between, Hibernate's version check fails this save with an
            // optimistic-locking exception (caught by ApiExceptionHandler) instead of one claim
            // silently overwriting the other's password.
            Student saved = studentRepository.save(existing);
            enrolInSelectedClasses(saved, selectedClasses);
            faceEnrollmentService.enrolFaceCaptures(saved.getId(), captureMetadata, captureImages);
            return sessionAuthService.issueToken(SessionAuthService.ROLE_STUDENT, saved.getId(), saved.getFullName(),
                    saved.getUniversityEmail(), saved.getApprovalStatus());
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
        // Self-registration never asks for a programme — "Unassigned" reads like a real (if odd)
        // programme name here, unlike a seat assignment where the word actually fits. Left blank;
        // the frontend shows "Not provided" for an empty value instead of the raw empty string.
        student.setProgramme("");
        student.setConsentGiven(request.consentGiven());
        student.setLevel(request.level());
        student.setPasswordHash(passwordEncoder.encode(request.password()));
        // A brand-new self-registration always needs Admin review before it's a real account — a
        // pre-provisioned record being claimed above is different (already vouched for) and keeps
        // whatever approval status it already had.
        student.setApprovalStatus("PENDING");
        student = studentRepository.save(student);
        enrolInSelectedClasses(student, selectedClasses);

        // Face enrollment is part of the same database transaction as the registration. If the
        // upload is incomplete or invalid, the exception rolls back the student and their class
        // requests, so Admin never sees a partial registration in the review queue.
        faceEnrollmentService.enrolFaceCaptures(student.getId(), captureMetadata, captureImages);

        return sessionAuthService.issueToken(SessionAuthService.ROLE_STUDENT, student.getId(), student.getFullName(),
                student.getUniversityEmail(), student.getApprovalStatus());
    }

    private List<CourseOffering> resolveSelectedClasses(List<UUID> classOfferingIds) {
        Set<UUID> requestedIds = Set.copyOf(classOfferingIds);
        List<CourseOffering> selected = courseOfferingRepository.findAllById(requestedIds);
        boolean allAvailable = selected.size() == requestedIds.size()
                && selected.stream().allMatch(offering -> "ACTIVE".equals(offering.getStatus()));
        if (!allAvailable) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "One or more selected classes are no longer open for registration. Refresh and try again.");
        }
        return selected;
    }

    // Registration only accepts real, active Admin-provisioned classes. They are resolved and
    // validated as a complete set above; a stale or archived selection fails the submission
    // instead of silently creating a student whose requested class is missing. Enrolments start
    // PENDING until Admin approves the registration (see StudentService.approveStudent).
    private void enrolInSelectedClasses(Student student, List<CourseOffering> selectedClasses) {
        for (CourseOffering offering : selectedClasses) {
            if (courseEnrollmentRepository.findByStudent_IdAndCourseOffering_Id(
                    student.getId(), offering.getId()).isPresent()) {
                continue;
            }
            CourseEnrollment enrollment = new CourseEnrollment();
            enrollment.setStudent(student);
            enrollment.setCourseOffering(offering);
            enrollment.setStatus(CourseEnrollment.EnrollmentStatus.PENDING);
            courseEnrollmentRepository.save(enrollment);
        }
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
            if (!SessionAuthService.ROLE_TEACHER.equals(existing.getRole())) {
                throw new ResponseStatusException(FORBIDDEN,
                        "Administrator accounts cannot be activated through public registration.");
            }
            if (!existing.getStaffNumber().equalsIgnoreCase(staffNumber)) {
                throw new ResponseStatusException(FORBIDDEN,
                        "The staff ID does not match the account invitation.");
            }
            if (STATUS_DEACTIVATED.equals(existing.getStatus())) {
                throw new ResponseStatusException(FORBIDDEN,
                        "This account has been deactivated. Contact an administrator.");
            }

            // Claim the exact passwordless teacher record provisioned by an administrator. Both
            // identifiers must match and neither the role nor staff number can be rewritten by a
            // public request.
            existing.setName(request.name().trim());
            existing.setPasswordHash(passwordEncoder.encode(request.password()));
            Teacher saved = teacherRepository.save(existing);
            return sessionAuthService.issueToken(saved.getRole(), saved.getId(), saved.getName(), saved.getEmail(),
                    "APPROVED");
        }

        throw new ResponseStatusException(FORBIDDEN,
                "An administrator must add your staff account before you can register.");
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim();

        Optional<Student> student = studentRepository.findByUniversityEmailIgnoreCase(email);
        if (student.isPresent() && matches(request.password(), student.get().getPasswordHash())) {
            Student found = student.get();
            if (STATUS_WITHDRAWN.equals(found.getStatus())) {
                throw new ResponseStatusException(UNAUTHORIZED,
                        "This account has been withdrawn. Contact an administrator.");
            }
            return sessionAuthService.issueToken(SessionAuthService.ROLE_STUDENT, found.getId(), found.getFullName(),
                    found.getUniversityEmail(), found.getApprovalStatus());
        }

        Optional<Teacher> teacher = teacherRepository.findByEmailIgnoreCase(email);
        if (teacher.isPresent() && matches(request.password(), teacher.get().getPasswordHash())) {
            Teacher found = teacher.get();
            if (STATUS_DEACTIVATED.equals(found.getStatus())) {
                throw new ResponseStatusException(UNAUTHORIZED,
                        "This account has been deactivated. Contact an administrator.");
            }
            return sessionAuthService.issueToken(found.getRole(), found.getId(), found.getName(), found.getEmail(),
                    "APPROVED");
        }

        throw new ResponseStatusException(UNAUTHORIZED, "Incorrect email or password.");
    }

    @Transactional(readOnly = true)
    public AuthResponse me(String token) {
        SessionAuthService.Principal principal = sessionAuthService.resolve(token);
        if (principal == null) {
            throw new ResponseStatusException(UNAUTHORIZED, "Your session has expired. Please sign in again.");
        }
        if (principal.role().equals(SessionAuthService.ROLE_STUDENT)) {
            Student student = studentRepository.findById(principal.id())
                    .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Account no longer exists."));
            if (STATUS_WITHDRAWN.equals(student.getStatus())) {
                sessionAuthService.logout(token);
                throw new ResponseStatusException(UNAUTHORIZED, "This account has been withdrawn.");
            }
            return new AuthResponse(token, SessionAuthService.ROLE_STUDENT, student.getId(), student.getFullName(),
                    student.getUniversityEmail(), student.getApprovalStatus());
        }
        Teacher teacher = teacherRepository.findById(principal.id())
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Account no longer exists."));
        if (STATUS_DEACTIVATED.equals(teacher.getStatus())) {
            // Covers the narrow window between an admin deactivating this teacher and the
            // explicit revokeSessionsFor call actually removing every one of their tokens —
            // belt-and-suspenders alongside that, not a replacement for it.
            sessionAuthService.logout(token);
            throw new ResponseStatusException(UNAUTHORIZED, "This account has been deactivated.");
        }
        return new AuthResponse(token, teacher.getRole(), teacher.getId(), teacher.getName(), teacher.getEmail(), "APPROVED");
    }

    private boolean matches(String rawPassword, String storedHash) {
        return storedHash != null && passwordEncoder.matches(rawPassword, storedHash);
    }

    /** Student records keep separate first/last name columns; self-registration only collects one field. */
    private String[] splitFullName(String fullName) {
        int spaceIndex = fullName.indexOf(' ');
        if (spaceIndex < 0) {
            return new String[] {fullName, ""};
        }
        return new String[] {fullName.substring(0, spaceIndex), fullName.substring(spaceIndex + 1).trim()};
    }
}
