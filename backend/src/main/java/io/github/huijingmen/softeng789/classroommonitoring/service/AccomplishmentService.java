package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AccomplishmentCorrectionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.AccomplishmentEntryRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.AccomplishmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateAccomplishmentsRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Accomplishment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AccomplishmentFeedback;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AccomplishmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AccomplishmentFeedbackRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class AccomplishmentService {
    private final AccomplishmentRepository accomplishmentRepository;
    private final AccomplishmentFeedbackRepository feedbackRepository;
    private final CourseOfferingRepository courseOfferingRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final StudentRepository studentRepository;
    private final TeacherScopeSupport access;

    public AccomplishmentService(
            AccomplishmentRepository accomplishmentRepository,
            AccomplishmentFeedbackRepository feedbackRepository,
            CourseOfferingRepository courseOfferingRepository,
            CourseEnrollmentRepository courseEnrollmentRepository,
            StudentRepository studentRepository,
            TeacherScopeSupport access
    ) {
        this.accomplishmentRepository = accomplishmentRepository;
        this.feedbackRepository = feedbackRepository;
        this.courseOfferingRepository = courseOfferingRepository;
        this.courseEnrollmentRepository = courseEnrollmentRepository;
        this.studentRepository = studentRepository;
        this.access = access;
    }

    @Transactional
    public List<AccomplishmentResponse> create(CreateAccomplishmentsRequest request, UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        CourseOffering offering = requireOffering(request.courseOfferingId());
        access.assertCanAccessOffering(offering, caller);
        assertUniqueStudents(request.entries());

        Instant confirmedAt = request.confirm() ? Instant.now() : null;
        List<Accomplishment> rows = request.entries().stream()
                .map(entry -> createRow(request, entry, offering, caller, confirmedAt))
                .toList();
        return accomplishmentRepository.saveAll(rows).stream()
                .map(row -> toResponse(row, FeedbackSnapshot.empty()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AccomplishmentResponse> list(UUID studentId, UUID courseOfferingId, UUID callerId) {
        if (studentId != null && courseOfferingId != null) {
            throw new ResponseStatusException(BAD_REQUEST, "Provide only one of studentId or courseOfferingId.");
        }
        Teacher caller = access.requireCaller(callerId);
        List<Accomplishment> rows;
        if (courseOfferingId != null) {
            CourseOffering offering = requireOffering(courseOfferingId);
            access.assertCanAccessOffering(offering, caller);
            rows = accomplishmentRepository.findByCourseOffering_IdOrderByAchievementDateDescCreatedAtDesc(
                    courseOfferingId);
        } else if (studentId != null) {
            rows = accomplishmentRepository.findByStudent_IdOrderByAchievementDateDescCreatedAtDesc(studentId);
        } else {
            rows = access.isAdmin(caller)
                    ? accomplishmentRepository.findAllByOrderByAchievementDateDescCreatedAtDesc()
                    : accomplishmentRepository
                            .findByCourseOffering_Teachers_IdOrderByAchievementDateDescCreatedAtDesc(callerId);
        }
        return toResponses(rows.stream()
                .filter(row -> access.isAdmin(caller) || row.getCourseOffering().isTaughtBy(caller))
                .toList());
    }

    @Transactional(readOnly = true)
    public List<AccomplishmentResponse> listForStudentPortal(UUID studentId) {
        return toResponses(accomplishmentRepository
                .findByStudent_IdAndStatusOrderByAchievementDateDescCreatedAtDesc(
                        studentId, Accomplishment.Status.CONFIRMED));
    }

    @Transactional
    public AccomplishmentResponse confirm(UUID id, UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        Accomplishment row = requireAccomplishment(id);
        access.assertCanAccessOffering(row.getCourseOffering(), caller);
        if (row.getStatus() != Accomplishment.Status.DRAFT) {
            throw new ResponseStatusException(CONFLICT, "Only draft accomplishments can be confirmed.");
        }
        row.setStatus(Accomplishment.Status.CONFIRMED);
        row.setConfirmedByTeacher(caller);
        row.setConfirmedAt(Instant.now());
        return responseFor(accomplishmentRepository.save(row));
    }

    @Transactional
    public AccomplishmentResponse revoke(UUID id, UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        Accomplishment row = requireAccomplishment(id);
        access.assertCanAccessOffering(row.getCourseOffering(), caller);
        if (row.getStatus() != Accomplishment.Status.CONFIRMED) {
            throw new ResponseStatusException(CONFLICT, "Only confirmed accomplishments can be revoked.");
        }
        row.setStatus(Accomplishment.Status.REVOKED);
        row.setRevokedByTeacher(caller);
        row.setRevokedAt(Instant.now());
        return responseFor(accomplishmentRepository.save(row));
    }

    @Transactional(readOnly = true)
    public AccomplishmentResponse responseFor(Accomplishment row) {
        return toResponses(List.of(row)).getFirst();
    }

    private Accomplishment createRow(
            CreateAccomplishmentsRequest request,
            AccomplishmentEntryRequest entry,
            CourseOffering offering,
            Teacher caller,
            Instant confirmedAt
    ) {
        Student student = studentRepository.findById(entry.studentId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found."));
        boolean enrolled = courseEnrollmentRepository.existsByStudent_IdAndCourseOffering_IdAndStatus(
                student.getId(), offering.getId(), CourseEnrollment.EnrollmentStatus.ACTIVE);
        if (!enrolled) {
            throw new ResponseStatusException(
                    BAD_REQUEST,
                    student.getFullName() + " is not actively enrolled in this class."
            );
        }

        Accomplishment row = new Accomplishment();
        row.setStudent(student);
        row.setCourseOffering(offering);
        row.setCreatedByTeacher(caller);
        row.setCategory(request.category());
        row.setTitle(request.title().trim());
        row.setDescription(access.blankToNull(request.description()));
        row.setStudentNote(access.blankToNull(entry.note()));
        row.setPoints(entry.points());
        row.setAchievementDate(request.achievementDate());
        row.setIncludeInReport(request.includeInReport());
        if (request.confirm()) {
            row.setStatus(Accomplishment.Status.CONFIRMED);
            row.setConfirmedByTeacher(caller);
            row.setConfirmedAt(confirmedAt);
        }
        return row;
    }

    private void assertUniqueStudents(List<AccomplishmentEntryRequest> entries) {
        Set<UUID> uniqueIds = new HashSet<>();
        boolean allUnique = entries.stream().allMatch(entry -> uniqueIds.add(entry.studentId()));
        if (!allUnique) {
            throw new ResponseStatusException(BAD_REQUEST, "Each student can only appear once in a batch.");
        }
    }

    private CourseOffering requireOffering(UUID id) {
        return courseOfferingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
    }

    private Accomplishment requireAccomplishment(UUID id) {
        return accomplishmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Accomplishment not found."));
    }

    private List<AccomplishmentResponse> toResponses(List<Accomplishment> rows) {
        if (rows.isEmpty()) return List.of();
        List<UUID> ids = rows.stream().map(Accomplishment::getId).toList();
        Map<UUID, FeedbackSnapshot> snapshots = feedbackSnapshots(ids);
        return rows.stream()
                .map(row -> toResponse(row, snapshots.getOrDefault(row.getId(), FeedbackSnapshot.empty())))
                .toList();
    }

    private Map<UUID, FeedbackSnapshot> feedbackSnapshots(List<UUID> accomplishmentIds) {
        Map<UUID, FeedbackSnapshot> snapshots = new HashMap<>();
        for (AccomplishmentFeedback feedback
                : feedbackRepository.findByAccomplishment_IdInOrderByCreatedAtDesc(accomplishmentIds)) {
            UUID accomplishmentId = feedback.getAccomplishment().getId();
            FeedbackSnapshot current = snapshots.getOrDefault(accomplishmentId, FeedbackSnapshot.empty());
            if (feedback.getType() == AccomplishmentFeedback.Type.ACKNOWLEDGEMENT
                    && current.acknowledgedAt() == null) {
                snapshots.put(accomplishmentId, new FeedbackSnapshot(feedback.getCreatedAt(), current.correction()));
            } else if (feedback.getType() == AccomplishmentFeedback.Type.CORRECTION_REQUEST
                    && current.correction() == null) {
                snapshots.put(accomplishmentId, new FeedbackSnapshot(
                        current.acknowledgedAt(),
                        correctionResponse(feedback)
                ));
            }
        }
        return snapshots;
    }

    private AccomplishmentCorrectionResponse correctionResponse(AccomplishmentFeedback feedback) {
        return new AccomplishmentCorrectionResponse(
                feedback.getId(),
                feedback.getStatus(),
                feedback.getMessage(),
                feedback.getStaffResponse(),
                feedback.getCreatedAt(),
                feedback.getReviewedAt(),
                feedback.getReviewedByTeacher() == null ? null : feedback.getReviewedByTeacher().getName()
        );
    }

    private AccomplishmentResponse toResponse(Accomplishment row, FeedbackSnapshot feedback) {
        CourseOffering offering = row.getCourseOffering();
        return new AccomplishmentResponse(
                row.getId(),
                row.getStudent().getId(),
                row.getStudent().getFullName(),
                row.getStudent().getStudentNumber(),
                offering.getId(),
                offering.getCourse().getCode() + " · " + offering.getAcademicTerm(),
                row.getCategory(),
                row.getTitle(),
                row.getDescription(),
                row.getStudentNote(),
                row.getPoints(),
                row.getAchievementDate(),
                row.isIncludeInReport(),
                row.getStatus(),
                row.getCreatedByTeacher().getId(),
                row.getCreatedByTeacher().getName(),
                row.getConfirmedByTeacher() == null ? null : row.getConfirmedByTeacher().getName(),
                row.getCreatedAt(),
                row.getConfirmedAt(),
                row.getRevokedAt(),
                feedback.acknowledgedAt(),
                feedback.correction()
        );
    }

    private record FeedbackSnapshot(Instant acknowledgedAt, AccomplishmentCorrectionResponse correction) {
        private static FeedbackSnapshot empty() {
            return new FeedbackSnapshot(null, null);
        }
    }
}
