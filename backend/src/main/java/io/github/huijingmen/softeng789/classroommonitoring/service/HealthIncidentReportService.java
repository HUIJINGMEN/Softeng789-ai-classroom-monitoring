package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateHealthIncidentReportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthIncidentReportFilter;
import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthIncidentReportResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentOptionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.TeacherClassOptionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.HealthAlert;
import io.github.huijingmen.softeng789.classroommonitoring.entity.HealthIncidentReport;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.HealthIncidentReportRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class HealthIncidentReportService {
    private final HealthIncidentReportRepository healthIncidentReportRepository;
    private final StudentRepository studentRepository;
    private final CourseOfferingRepository courseOfferingRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final ClassroomSessionRepository classroomSessionRepository;
    private final TeacherScopeSupport access;

    public HealthIncidentReportService(
            HealthIncidentReportRepository healthIncidentReportRepository,
            StudentRepository studentRepository,
            CourseOfferingRepository courseOfferingRepository,
            CourseEnrollmentRepository courseEnrollmentRepository,
            ClassroomSessionRepository classroomSessionRepository,
            TeacherScopeSupport access
    ) {
        this.healthIncidentReportRepository = healthIncidentReportRepository;
        this.studentRepository = studentRepository;
        this.courseOfferingRepository = courseOfferingRepository;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.classroomSessionRepository = classroomSessionRepository;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<HealthIncidentReportResponse> listReports(UUID callerId, HealthIncidentReportFilter filter) {
        Teacher caller = access.requireCaller(callerId);
        List<HealthIncidentReport> scoped = access.isAdmin(caller)
                ? healthIncidentReportRepository.findAllByOrderByCreatedAtDesc()
                : healthIncidentReportRepository.findByCourseOffering_Teachers_IdOrderByCreatedAtDesc(callerId);

        return scoped.stream()
                .filter(report -> matches(report, filter))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public HealthIncidentReportResponse getReport(UUID id, UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        HealthIncidentReport report = requireReport(id);
        assertCanAccess(report, caller);
        return toResponse(report);
    }

    @Transactional
    public HealthIncidentReportResponse createManualReport(CreateHealthIncidentReportRequest request, UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        Student student = studentRepository.findById(request.studentId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found."));
        CourseOffering offering = courseOfferingRepository.findById(request.courseOfferingId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));

        if (!access.isAdmin(caller) && !offering.isTaughtBy(caller)) {
            throw new ResponseStatusException(FORBIDDEN, "You can only create reports for your own classes.");
        }
        boolean activelyEnrolled = courseEnrollmentRepository.existsByStudent_IdAndCourseOffering_IdAndStatus(
                student.getId(), offering.getId(), CourseEnrollment.EnrollmentStatus.ACTIVE);
        if (!activelyEnrolled) {
            throw new ResponseStatusException(BAD_REQUEST, "This student is not actively enrolled in that class.");
        }

        ClassroomSession session = null;
        if (request.sessionId() != null) {
            session = classroomSessionRepository.findById(request.sessionId())
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Classroom session not found."));
            CourseOffering sessionOffering = session.getCourseOffering();
            if (sessionOffering != null && !sessionOffering.getId().equals(offering.getId())) {
                throw new ResponseStatusException(BAD_REQUEST, "Selected session does not belong to that class.");
            }
        }

        HealthIncidentReport report = new HealthIncidentReport();
        report.setStudent(student);
        report.setCourseOffering(offering);
        report.setSession(session);
        report.setTeacher(caller);
        report.setSource(HealthIncidentReport.Source.TEACHER_REPORTED.name());
        report.setIncidentType(request.incidentType().trim());
        report.setOccurredAt(request.occurredAt());
        report.setDescription(request.description().trim());
        report.setActionTaken(access.blankToNull(request.actionTaken()));
        report.setTeacherNotes(access.blankToNull(request.teacherNotes()));
        report = healthIncidentReportRepository.save(report);
        return toResponse(report);
    }

    /** Called directly by {@code HealthAlertService.confirmAlert} — the two services are
     *  otherwise independent, but confirming an alert always produces exactly one report, so
     *  there's no reason to duplicate this mapping behind a repository-only boundary. */
    @Transactional
    public HealthIncidentReport createFromAlert(HealthAlert alert, Teacher reviewer) {
        CourseOffering offering = alert.getSession().getCourseOffering();
        if (offering == null) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "This alert's session has no associated class; cannot create a report.");
        }

        HealthIncidentReport report = new HealthIncidentReport();
        report.setStudent(alert.getStudent());
        report.setCourseOffering(offering);
        report.setSession(alert.getSession());
        report.setTeacher(reviewer);
        report.setSource(HealthIncidentReport.Source.AI_DETECTED.name());
        report.setIncidentType(alert.getEventType());
        report.setOccurredAt(alert.getDetectedAt());
        report.setDescription("AI-detected event confirmed by teacher: " + alert.getEventType());
        report.setActionTaken(alert.getActionTaken());
        report.setTeacherNotes(alert.getTeacherNotes());
        report.setHealthAlert(alert);
        return healthIncidentReportRepository.save(report);
    }

    @Transactional(readOnly = true)
    public List<TeacherClassOptionResponse> listMyClasses(UUID callerId) {
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
                                .map(enrollment -> new StudentOptionResponse(
                                        enrollment.getStudent().getId(),
                                        enrollment.getStudent().getFullName(),
                                        enrollment.getStudent().getStudentNumber()))
                                .toList()))
                .toList();
    }

    private boolean matches(HealthIncidentReport report, HealthIncidentReportFilter filter) {
        if (filter.courseOfferingId() != null && !filter.courseOfferingId().equals(report.getCourseOffering().getId())) {
            return false;
        }
        if (filter.studentId() != null && !filter.studentId().equals(report.getStudent().getId())) {
            return false;
        }
        if (filter.source() != null && !filter.source().equalsIgnoreCase(report.getSource())) {
            return false;
        }
        if (filter.incidentType() != null && !filter.incidentType().equalsIgnoreCase(report.getIncidentType())) {
            return false;
        }
        if (filter.dateFrom() != null && report.getOccurredAt().isBefore(filter.dateFrom())) {
            return false;
        }
        return filter.dateTo() == null || !report.getOccurredAt().isAfter(filter.dateTo());
    }

    private HealthIncidentReport requireReport(UUID id) {
        return healthIncidentReportRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Health incident report not found."));
    }

    private void assertCanAccess(HealthIncidentReport report, Teacher caller) {
        access.assertCanAccessOffering(report.getCourseOffering(), caller);
    }

    private HealthIncidentReportResponse toResponse(HealthIncidentReport report) {
        ClassroomSession session = report.getSession();
        CourseOffering offering = report.getCourseOffering();
        HealthAlert healthAlert = report.getHealthAlert();
        return new HealthIncidentReportResponse(
                report.getId(),
                report.getStudent().getId(),
                report.getStudent().getFullName(),
                offering.getId(),
                offering.getCourse().getCode() + " · " + offering.getAcademicTerm(),
                session == null ? null : session.getId(),
                session == null ? null : session.getCourse() + " · " + session.getRoom(),
                report.getTeacher().getId(),
                report.getTeacher().getName(),
                report.getSource(),
                report.getIncidentType(),
                report.getOccurredAt(),
                report.getDescription(),
                report.getActionTaken(),
                report.getTeacherNotes(),
                healthAlert == null ? null : healthAlert.getId(),
                report.getCreatedAt()
        );
    }
}
