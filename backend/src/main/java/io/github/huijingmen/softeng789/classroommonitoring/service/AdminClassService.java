package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AddClassTeacherRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassTeacherSummary;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PublicClassSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateClassRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * "Class" is a CourseOffering that Admin explicitly provisions — it's the only place these get
 * created now, replacing the old auto-creation that used to happen whenever a session was
 * scheduled. Handles class CRUD and teacher assignment; student roster management (add/remove/
 * transfer) lives in {@link ClassRosterService}, which depends on this class for class lookup
 * and response mapping rather than duplicating either.
 */
@Service
public class AdminClassService {
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final Set<String> VALID_STATUSES = Set.of("ACTIVE", "ARCHIVED");

    private final CourseOfferingRepository courseOfferingRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final TeacherRepository teacherRepository;
    private final CourseLookupService courseLookupService;
    private final TeacherScopeSupport access;

    public AdminClassService(
            CourseOfferingRepository courseOfferingRepository,
            CourseEnrollmentRepository courseEnrollmentRepository,
            TeacherRepository teacherRepository,
            CourseLookupService courseLookupService,
            TeacherScopeSupport access
    ) {
        this.courseOfferingRepository = courseOfferingRepository;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.teacherRepository = teacherRepository;
        this.courseLookupService = courseLookupService;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<ClassResponse> listClasses() {
        return courseOfferingRepository.findAllByOrderByOfferingCodeAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    // Unauthenticated on purpose — the self-registration page needs to show what's available to
    // pick before an account exists. Deliberately a lighter shape than ClassSummaryResponse: no
    // teacher names/emails, since there's no reason to expose staff contact details to anonymous
    // visitors.
    @Transactional(readOnly = true)
    public List<PublicClassSummaryResponse> listActiveClassesForRegistration() {
        return courseOfferingRepository.findAllByStatusOrderByOfferingCodeAsc(STATUS_ACTIVE).stream()
                .map(offering -> new PublicClassSummaryResponse(
                        offering.getId(),
                        offering.getCourse().getCode(),
                        offering.getOfferingCode(),
                        offering.getAcademicTerm()
                ))
                .toList();
    }

    // Used by both the session-scheduling dropdown and the teacher-facing read-only "Classes"
    // page — an admin sees every active class, a plain teacher only the ones they teach (same
    // "own classes only" rule as everywhere else, via TeacherScopeSupport).
    @Transactional(readOnly = true)
    public List<ClassSummaryResponse> listActiveClassesForScheduling(UUID callerId) {
        boolean admin = access.isAdmin(access.requireCaller(callerId));
        List<CourseOffering> offerings = admin
                ? courseOfferingRepository.findAllByStatusOrderByOfferingCodeAsc(STATUS_ACTIVE)
                : courseOfferingRepository.findByTeachers_IdAndStatusOrderByOfferingCodeAsc(callerId, STATUS_ACTIVE);
        return offerings.stream()
                .map(offering -> new ClassSummaryResponse(
                        offering.getId(),
                        offering.getCourse().getCode(),
                        offering.getOfferingCode(),
                        offering.getAcademicTerm(),
                        teacherSummaries(offering),
                        (int) courseEnrollmentRepository.countByCourseOffering_IdAndStatus(
                                offering.getId(), CourseEnrollment.EnrollmentStatus.ACTIVE)
                ))
                .toList();
    }

    @Transactional
    public ClassResponse createClass(CreateClassRequest request) {
        String courseCode = courseLookupService.normaliseCourseCode(
                requireText(request.courseCode(), "Course is required."));
        String academicTerm = requireText(request.academicTerm(), "Academic term is required.");
        String offeringCode = courseCode + " " + academicTerm;

        if (courseOfferingRepository.findByOfferingCodeIgnoreCase(offeringCode).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "A class with that course and term already exists.");
        }

        // A teacher can be assigned later from the class detail page — requiring one up front used
        // to be the only mandatory field beyond course/term, which made creating a class more
        // ceremony than it needed to be.
        List<UUID> requestedTeacherIds = request.teacherIds() == null ? List.of() : request.teacherIds();
        List<Teacher> teachers = teacherRepository.findAllById(requestedTeacherIds);
        if (teachers.size() != requestedTeacherIds.size()) {
            throw new ResponseStatusException(BAD_REQUEST, "One or more teachers were not found.");
        }
        teachers.forEach(this::requireActiveTeacher);

        Course course = courseLookupService.findOrCreateCourse(courseCode);

        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode(offeringCode);
        offering.setAcademicTerm(academicTerm);
        offering.getTeachers().addAll(teachers);
        return toResponse(courseOfferingRepository.save(offering));
    }

    @Transactional
    public ClassResponse updateClass(UUID id, UpdateClassRequest request) {
        CourseOffering offering = findEntity(id);
        String status = normaliseStatus(request.status());
        String academicTerm = requireText(request.academicTerm(), "Academic term is required.");
        String offeringCode = offering.getCourse().getCode() + " " + academicTerm;

        if (!offeringCode.equalsIgnoreCase(offering.getOfferingCode())) {
            courseOfferingRepository.findByOfferingCodeIgnoreCase(offeringCode).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new ResponseStatusException(CONFLICT, "A class with that course and term already exists.");
                }
            });
            offering.setOfferingCode(offeringCode);
        }
        offering.setAcademicTerm(academicTerm);
        offering.setStatus(status);
        return toResponse(courseOfferingRepository.save(offering));
    }

    @Transactional
    public ClassResponse addTeacher(UUID classId, AddClassTeacherRequest request) {
        CourseOffering offering = findEntity(classId);
        Teacher teacher = teacherRepository.findById(request.teacherId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Teacher not found."));
        requireActiveTeacher(teacher);
        offering.getTeachers().add(teacher);
        return toResponse(courseOfferingRepository.save(offering));
    }

    // Deactivated staff can't be handed any new responsibility (a fresh class assignment or a new
    // session), but a class or session they were already attached to keeps them exactly as-is —
    // see teacherSummaries, which deliberately doesn't filter them out of what's already assigned.
    private void requireActiveTeacher(Teacher teacher) {
        if (!"ACTIVE".equals(teacher.getStatus())) {
            throw new ResponseStatusException(BAD_REQUEST,
                    teacher.getName() + " has been deactivated and can't be assigned to a class.");
        }
    }

    // A class is allowed to end up with zero teachers — that's a real, visible "No teacher
    // assigned" state (see ClassroomSessionService, which blocks scheduling against such a class)
    // rather than something that needs a placeholder account to paper over.
    @Transactional
    public ClassResponse removeTeacher(UUID classId, UUID teacherId) {
        CourseOffering offering = findEntity(classId);
        boolean removed = offering.getTeachers().removeIf(teacher -> teacher.getId().equals(teacherId));
        if (!removed) {
            throw new ResponseStatusException(NOT_FOUND, "That teacher is not assigned to this class.");
        }
        return toResponse(courseOfferingRepository.save(offering));
    }

    CourseOffering findEntity(UUID id) {
        return courseOfferingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
    }

    ClassResponse toResponse(CourseOffering offering) {
        long studentCount = courseEnrollmentRepository.countByCourseOffering_IdAndStatus(
                offering.getId(), CourseEnrollment.EnrollmentStatus.ACTIVE);
        return new ClassResponse(
                offering.getId(),
                offering.getCourse().getCode(),
                offering.getOfferingCode(),
                offering.getAcademicTerm(),
                offering.getStatus(),
                teacherSummaries(offering),
                studentCount
        );
    }

    // Includes deactivated teachers deliberately — a class still shows who it's historically
    // assigned to even after that person is deactivated (see addTeacher, which is the one place
    // that must reject them going forward).
    private List<ClassTeacherSummary> teacherSummaries(CourseOffering offering) {
        return offering.getTeachers().stream()
                .map(teacher -> new ClassTeacherSummary(teacher.getId(), teacher.getName(), teacher.getEmail(),
                        teacher.getStatus()))
                .sorted(Comparator.comparing(ClassTeacherSummary::name))
                .toList();
    }

    private String normaliseStatus(String status) {
        String normalised = requireText(status, "Status is required.").toUpperCase(Locale.ROOT);
        if (!VALID_STATUSES.contains(normalised)) {
            throw new ResponseStatusException(BAD_REQUEST, "status must be ACTIVE or ARCHIVED.");
        }
        return normalised;
    }

    private String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, message);
        }
        return value.trim().replaceAll("\\s+", " ");
    }
}
