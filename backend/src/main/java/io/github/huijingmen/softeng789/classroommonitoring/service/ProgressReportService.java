package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ProgressReportResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentOptionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.TeacherClassOptionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ProgressReport;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ProgressReportRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class ProgressReportService {
    private final ProgressReportRepository progressReportRepository;
    private final StudentRepository studentRepository;
    private final CourseOfferingRepository courseOfferingRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final ProgressReportStorageService storageService;
    private final TeacherScopeSupport access;

    public ProgressReportService(
            ProgressReportRepository progressReportRepository,
            StudentRepository studentRepository,
            CourseOfferingRepository courseOfferingRepository,
            CourseEnrollmentRepository courseEnrollmentRepository,
            ProgressReportStorageService storageService,
            TeacherScopeSupport access
    ) {
        this.progressReportRepository = progressReportRepository;
        this.studentRepository = studentRepository;
        this.courseOfferingRepository = courseOfferingRepository;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.storageService = storageService;
        this.access = access;
    }

    // Called either by the companion mobile app (photo + comment) or directly from this web app's
    // StudentProfile page (text-only feedback, no camera UI here) — photo is optional so both
    // paths share one entity and one list.
    @Transactional
    public ProgressReportResponse createReport(
            UUID studentId,
            UUID courseOfferingId,
            String comment,
            MultipartFile photo,
            UUID callerId
    ) {
        Teacher caller = access.requireCaller(callerId);
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found."));
        CourseOffering offering = courseOfferingRepository.findById(courseOfferingId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));

        if (!access.isAdmin(caller) && !offering.isTaughtBy(caller)) {
            throw new ResponseStatusException(FORBIDDEN, "You can only create reports for your own classes.");
        }
        boolean activelyEnrolled = courseEnrollmentRepository.existsByStudent_IdAndCourseOffering_IdAndStatus(
                student.getId(), offering.getId(), CourseEnrollment.EnrollmentStatus.ACTIVE);
        if (!activelyEnrolled) {
            throw new ResponseStatusException(BAD_REQUEST, "This student is not actively enrolled in that class.");
        }
        if (comment == null || comment.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "A comment is required.");
        }

        ProgressReport report = new ProgressReport();
        report.setStudent(student);
        report.setCourseOffering(offering);
        report.setTeacher(caller);
        report.setComment(comment.trim());
        report = progressReportRepository.save(report);

        if (photo != null && !photo.isEmpty()) {
            try {
                storageService.savePhoto(report.getId(), photo.getBytes());
            } catch (java.io.IOException ex) {
                throw new ResponseStatusException(BAD_REQUEST, "Could not read uploaded photo.", ex);
            }
        }
        return toResponse(report);
    }

    // Used by StudentProfile.tsx — a student may be enrolled across several of the caller's
    // classes (or classes the caller doesn't teach at all), so a plain teacher only sees the
    // reports tied to a class they actually teach; an admin sees everything for this student.
    @Transactional(readOnly = true)
    public List<ProgressReportResponse> listForStudent(UUID studentId, UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        List<ProgressReport> reports = progressReportRepository.findByStudent_IdOrderByCreatedAtDesc(studentId);
        return reports.stream()
                .filter(report -> access.isAdmin(caller) || report.getCourseOffering().isTaughtBy(caller))
                .map(this::toResponse)
                .toList();
    }

    /** Student-portal read model. Authorization is performed by the controller before this is
     * called, so the student receives every teacher-authored note that belongs to their own
     * record, across all of their classes, and never another student's note. */
    @Transactional(readOnly = true)
    public List<ProgressReportResponse> listForStudentPortal(UUID studentId) {
        return progressReportRepository.findByStudent_IdOrderByCreatedAtDesc(studentId).stream()
                .map(this::toResponse)
                .toList();
    }

    // Used by the class detail page's Reports tab — every report already belongs to exactly one
    // offering, so this is a single ownership check against that offering rather than the
    // per-report filter listForStudent needs (a student can be enrolled across several classes).
    @Transactional(readOnly = true)
    public List<ProgressReportResponse> listForClass(UUID courseOfferingId, UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        CourseOffering offering = courseOfferingRepository.findById(courseOfferingId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
        access.assertCanAccessOffering(offering, caller);
        return progressReportRepository.findByCourseOffering_IdOrderByCreatedAtDesc(courseOfferingId).stream()
                .map(this::toResponse)
                .toList();
    }

    // Backs the system-wide Reports page — every report the caller can see, with no
    // student/class filter. Mirrors listStudents/listSessions's own admin-sees-all,
    // teacher-sees-own-classes split (StudentService, ClassroomSessionService).
    @Transactional(readOnly = true)
    public List<ProgressReportResponse> listForCaller(UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        List<ProgressReport> reports = access.isAdmin(caller)
                ? progressReportRepository.findAllByOrderByCreatedAtDesc()
                : progressReportRepository.findByCourseOffering_Teachers_IdOrderByCreatedAtDesc(callerId);
        return reports.stream().map(this::toResponse).toList();
    }

    /** Mobile feedback composer read model: one request returns exactly the classes the caller may
     * write feedback for and each class's active roster. Teachers see their own classes; admins
     * retain the global scope used by the web console. */
    @Transactional(readOnly = true)
    public List<TeacherClassOptionResponse> listFeedbackClasses(UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        List<CourseOffering> offerings = access.isAdmin(caller)
                ? courseOfferingRepository.findAllByStatusOrderByOfferingCodeAsc("ACTIVE")
                : courseOfferingRepository.findByTeachers_IdAndStatusOrderByOfferingCodeAsc(callerId, "ACTIVE");

        return offerings.stream()
                .map(offering -> new TeacherClassOptionResponse(
                        offering.getId(),
                        offering.getCourse().getCode() + " · " + offering.getAcademicTerm(),
                        courseEnrollmentRepository
                                .findByCourseOffering_IdAndStatusOrderByStudent_LastNameAscStudent_FirstNameAsc(
                                        offering.getId(), CourseEnrollment.EnrollmentStatus.ACTIVE)
                                .stream()
                                .filter(enrollment -> "ACTIVE".equals(enrollment.getStudent().getStatus()))
                                .map(enrollment -> new StudentOptionResponse(
                                        enrollment.getStudent().getId(),
                                        enrollment.getStudent().getFullName(),
                                        enrollment.getStudent().getStudentNumber()))
                                .toList()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Resource getPhoto(UUID reportId) {
        return storageService.photo(reportId);
    }

    private ProgressReportResponse toResponse(ProgressReport report) {
        CourseOffering offering = report.getCourseOffering();
        return new ProgressReportResponse(
                report.getId(),
                report.getStudent().getId(),
                report.getStudent().getFullName(),
                offering.getId(),
                offering.getCourse().getCode() + " · " + offering.getAcademicTerm(),
                report.getTeacher().getId(),
                report.getTeacher().getName(),
                report.getComment(),
                storageService.hasPhoto(report.getId()) ? storageService.photoUrl(report.getId()) : null,
                report.getCreatedAt()
        );
    }
}
