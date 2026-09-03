package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ConfirmHealthAlertRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.DismissHealthAlertRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthAlertFilter;
import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthAlertResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.IngestHealthEventRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.HealthAlert;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.HealthAlertRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class HealthAlertService {
    private final HealthAlertRepository healthAlertRepository;
    private final StudentRepository studentRepository;
    private final ClassroomSessionRepository classroomSessionRepository;
    private final HealthIncidentReportService healthIncidentReportService;
    private final HealthAccessSupport access;

    public HealthAlertService(
            HealthAlertRepository healthAlertRepository,
            StudentRepository studentRepository,
            ClassroomSessionRepository classroomSessionRepository,
            HealthIncidentReportService healthIncidentReportService,
            HealthAccessSupport access
    ) {
        this.healthAlertRepository = healthAlertRepository;
        this.studentRepository = studentRepository;
        this.classroomSessionRepository = classroomSessionRepository;
        this.healthIncidentReportService = healthIncidentReportService;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<HealthAlertResponse> listAlerts(UUID callerId, HealthAlertFilter filter) {
        Teacher caller = access.requireCaller(callerId);
        List<HealthAlert> scoped = access.isAdmin(caller)
                ? healthAlertRepository.findAllByOrderByDetectedAtDesc()
                : healthAlertRepository.findBySession_CourseOffering_Teachers_IdOrderByDetectedAtDesc(callerId);

        return scoped.stream()
                .filter(alert -> matches(alert, filter))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public HealthAlertResponse getAlert(UUID id, UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        HealthAlert alert = requireAlert(id);
        assertCanAccess(alert, caller);
        return toResponse(alert);
    }

    @Transactional
    public HealthAlertResponse confirmAlert(UUID id, UUID callerId, ConfirmHealthAlertRequest request) {
        Teacher caller = access.requireCaller(callerId);
        HealthAlert alert = requireAlert(id);
        assertCanAccess(alert, caller);
        requireAwaitingReview(alert);

        if (request.eventType() != null && !request.eventType().isBlank()) {
            alert.setEventType(request.eventType().trim());
        }
        if (request.teacherNotes() != null) {
            alert.setTeacherNotes(access.blankToNull(request.teacherNotes()));
        }
        if (request.actionTaken() != null) {
            alert.setActionTaken(access.blankToNull(request.actionTaken()));
        }
        alert.setReviewedBy(caller);
        alert.setReviewedAt(Instant.now());
        alert.setStatus(HealthAlert.Status.CONFIRMED.name());
        alert = healthAlertRepository.save(alert);

        healthIncidentReportService.createFromAlert(alert, caller);
        return toResponse(alert);
    }

    @Transactional
    public HealthAlertResponse dismissAlert(UUID id, UUID callerId, DismissHealthAlertRequest request) {
        Teacher caller = access.requireCaller(callerId);
        HealthAlert alert = requireAlert(id);
        assertCanAccess(alert, caller);
        requireAwaitingReview(alert);

        if (request.teacherNotes() != null) {
            alert.setTeacherNotes(access.blankToNull(request.teacherNotes()));
        }
        alert.setReviewedBy(caller);
        alert.setReviewedAt(Instant.now());
        alert.setStatus(HealthAlert.Status.DISMISSED.name());
        alert = healthAlertRepository.save(alert);
        return toResponse(alert);
    }

    @Transactional
    public HealthAlertResponse ingestAlert(IngestHealthEventRequest request) {
        Student student = studentRepository.findById(request.studentId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found."));
        ClassroomSession session = classroomSessionRepository.findById(request.sessionId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Classroom session not found."));

        HealthAlert alert = new HealthAlert();
        alert.setStudent(student);
        alert.setSession(session);
        alert.setEventType(EventTypeMapper.normalise(request.eventType()));
        alert.setConfidence(request.confidence());
        alert.setDetectedAt(request.detectedAt() != null ? request.detectedAt() : Instant.now());
        alert.setEvidenceUrl(request.evidenceUrl());
        alert.setStatus(HealthAlert.Status.AWAITING_REVIEW.name());
        alert = healthAlertRepository.save(alert);
        return toResponse(alert);
    }

    private void requireAwaitingReview(HealthAlert alert) {
        if (!HealthAlert.Status.AWAITING_REVIEW.name().equals(alert.getStatus())) {
            throw new ResponseStatusException(BAD_REQUEST, "This alert has already been reviewed.");
        }
    }

    private HealthAlert requireAlert(UUID id) {
        return healthAlertRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Health alert not found."));
    }

    private void assertCanAccess(HealthAlert alert, Teacher caller) {
        access.assertCanAccessOffering(alert.getSession().getCourseOffering(), caller);
    }

    private boolean matches(HealthAlert alert, HealthAlertFilter filter) {
        if (filter.courseOfferingId() != null) {
            CourseOffering offering = alert.getSession().getCourseOffering();
            if (offering == null || !filter.courseOfferingId().equals(offering.getId())) {
                return false;
            }
        }
        if (filter.studentId() != null && !filter.studentId().equals(alert.getStudent().getId())) {
            return false;
        }
        if (filter.status() != null && !filter.status().equalsIgnoreCase(alert.getStatus())) {
            return false;
        }
        if (filter.eventType() != null && !filter.eventType().equalsIgnoreCase(alert.getEventType())) {
            return false;
        }
        if (filter.source() != null && !filter.source().equalsIgnoreCase(alert.getSource())) {
            return false;
        }
        if (filter.dateFrom() != null && alert.getDetectedAt().isBefore(filter.dateFrom())) {
            return false;
        }
        return filter.dateTo() == null || !alert.getDetectedAt().isAfter(filter.dateTo());
    }

    private HealthAlertResponse toResponse(HealthAlert alert) {
        ClassroomSession session = alert.getSession();
        CourseOffering offering = session.getCourseOffering();
        String classLabel = offering != null
                ? offering.getCourse().getCode() + " · " + offering.getAcademicTerm()
                : session.getCourse();
        Teacher reviewedBy = alert.getReviewedBy();
        return new HealthAlertResponse(
                alert.getId(),
                alert.getStudent().getId(),
                alert.getStudent().getFullName(),
                session.getId(),
                classLabel,
                session.getRoom(),
                alert.getDetectedAt(),
                alert.getEventType(),
                alert.getConfidence(),
                alert.getSource(),
                alert.getStatus(),
                alert.getEvidenceUrl(),
                reviewedBy == null ? null : reviewedBy.getId(),
                reviewedBy == null ? null : reviewedBy.getName(),
                alert.getReviewedAt(),
                alert.getTeacherNotes(),
                alert.getActionTaken(),
                alert.getCreatedAt()
        );
    }
}
