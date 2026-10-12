package io.github.huijingmen.softeng789.classroommonitoring.support.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment.EnrollmentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestType;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequesterRole;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentSupportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.AdminStudentSupportRequestsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.CreateStudentSupportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.ReviewDecision;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.ReviewStudentSupportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.StudentSupportRequestResponse;
import io.github.huijingmen.softeng789.classroommonitoring.support.repository.StudentSupportRequestRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class StudentSupportRequestService {
    private static final int MAX_PAGE_SIZE = 100;
    private final StudentSupportRequestRepository requestRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final ClassroomSessionRepository sessionRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final LeaveRequestApprovalService leaveApprovalService;
    private final StudentSupportRequestMapper responseMapper;

    public StudentSupportRequestService(
            StudentSupportRequestRepository requestRepository,
            StudentRepository studentRepository,
            TeacherRepository teacherRepository,
            ClassroomSessionRepository sessionRepository,
            CourseEnrollmentRepository enrollmentRepository,
            LeaveRequestApprovalService leaveApprovalService,
            StudentSupportRequestMapper responseMapper
    ) {
        this.requestRepository = requestRepository;
        this.studentRepository = studentRepository;
        this.teacherRepository = teacherRepository;
        this.sessionRepository = sessionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.leaveApprovalService = leaveApprovalService;
        this.responseMapper = responseMapper;
    }

    @Transactional
    public StudentSupportRequestResponse submit(UUID studentId, CreateStudentSupportRequest request) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found."));

        ClassroomSession session = request.sessionId() == null ? null : requireSession(request.sessionId());
        CourseOffering offering = session == null
                ? offering(studentId, request.courseOfferingId())
                : session.getCourseOffering();

        if (session != null) {
            requireActiveEnrollment(studentId, session.getCourseOffering());
        }
        validateRequest(studentId, request, session);

        StudentSupportRequest entity = new StudentSupportRequest();
        entity.setStudent(student);
        applyContact(entity, student, request);
        entity.setType(request.type());
        entity.setCourseOffering(offering);
        entity.setSession(session);
        entity.setLeaveReason(request.type() == StudentRequestType.LEAVE ? request.leaveReason() : null);
        entity.setSubject(clean(request.subject()));
        entity.setMessage(clean(request.message()));
        return response(requestRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<StudentSupportRequestResponse> studentRequests(UUID studentId) {
        if (!studentRepository.existsById(studentId)) throw notFound();
        return requestRepository.findByStudent_IdOrderBySubmittedAtDesc(studentId).stream()
                .map(this::response)
                .toList();
    }

    @Transactional
    public StudentSupportRequestResponse cancel(UUID studentId, UUID requestId) {
        StudentSupportRequest request = requireForUpdate(requestId);
        if (!request.getStudent().getId().equals(studentId)) throw notFound();
        if (request.getStatus() != StudentRequestStatus.SUBMITTED) {
            throw new ResponseStatusException(BAD_REQUEST, "Only a request awaiting review can be withdrawn.");
        }
        request.setStatus(StudentRequestStatus.CANCELLED);
        request.setCancelledAt(Instant.now());
        return response(requestRepository.save(request));
    }

    @Transactional(readOnly = true)
    public AdminStudentSupportRequestsResponse adminRequests(
            StudentRequestStatus status,
            int page,
            int size
    ) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid student-request page.");
        }
        StudentRequestStatus selected = status == null ? StudentRequestStatus.SUBMITTED : status;
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "submittedAt"));
        Page<StudentSupportRequest> requests = requestRepository.findByStatus(selected, pageable);
        return new AdminStudentSupportRequestsResponse(
                requestRepository.countByStatus(StudentRequestStatus.SUBMITTED),
                PageResponse.from(requests, this::response)
        );
    }

    @Transactional
    public StudentSupportRequestResponse review(
            UUID adminId,
            UUID requestId,
            ReviewStudentSupportRequest review
    ) {
        StudentSupportRequest request = requireForUpdate(requestId);
        if (request.getStatus() != StudentRequestStatus.SUBMITTED) {
            throw new ResponseStatusException(BAD_REQUEST, "This student request has already been reviewed.");
        }
        validateDecision(request.getType(), review.decision());
        if (review.decision() != ReviewDecision.APPROVE && review.lessonTreatment() != null) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "A lesson treatment is only valid when approving leave.");
        }
        Teacher admin = teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));

        if (review.decision() == ReviewDecision.APPROVE) {
            leaveApprovalService.approve(request, admin, review.lessonTreatment(), review.note());
        }

        request.setStatus(switch (review.decision()) {
            case APPROVE -> StudentRequestStatus.APPROVED;
            case DECLINE -> StudentRequestStatus.DECLINED;
            case RESOLVE -> StudentRequestStatus.RESOLVED;
        });
        request.setReviewNote(clean(review.note()));
        request.setReviewedByAdmin(admin);
        request.setReviewedAt(Instant.now());
        return response(requestRepository.save(request));
    }

    private ClassroomSession requireSession(UUID sessionId) {
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class session not found."));
    }

    private CourseOffering offering(UUID studentId, UUID offeringId) {
        if (offeringId == null) return null;
        return enrollmentRepository
                .findByStudent_IdAndCourseOffering_IdAndStatus(studentId, offeringId, EnrollmentStatus.ACTIVE)
                .map(enrollment -> enrollment.getCourseOffering())
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Choose one of your active classes."));
    }

    private void requireActiveEnrollment(UUID studentId, CourseOffering offering) {
        if (offering == null || !enrollmentRepository.existsByStudent_IdAndCourseOffering_IdAndStatus(
                studentId,
                offering.getId(),
                EnrollmentStatus.ACTIVE
        )) {
            throw new ResponseStatusException(BAD_REQUEST, "This lesson is not in your active timetable.");
        }
    }

    private void validateRequest(
            UUID studentId,
            CreateStudentSupportRequest request,
            ClassroomSession session
    ) {
        if (request.type() != StudentRequestType.LEAVE) {
            if (request.leaveReason() != null) {
                throw new ResponseStatusException(BAD_REQUEST, "A leave reason is only valid for leave requests.");
            }
            return;
        }
        if (session == null || request.leaveReason() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Choose the lesson and reason for your leave request.");
        }
        if (session.getStatus() == ClassroomSession.SessionStatus.CANCELLED
                || session.getStartTime().isBefore(Instant.now())) {
            throw new ResponseStatusException(BAD_REQUEST, "Leave can only be requested for an upcoming lesson.");
        }
        if (requestRepository.existsByStudent_IdAndSession_IdAndStatusIn(
                studentId,
                session.getId(),
                List.of(StudentRequestStatus.SUBMITTED, StudentRequestStatus.APPROVED)
        )) {
            throw new ResponseStatusException(BAD_REQUEST, "A leave request for this lesson already exists.");
        }
    }

    private void applyContact(
            StudentSupportRequest entity,
            Student student,
            CreateStudentSupportRequest request
    ) {
        entity.setRequesterRole(request.requesterRole());
        if (request.requesterRole() == StudentRequesterRole.STUDENT) {
            entity.setContactName(student.getFullName());
            entity.setContactEmail(student.getUniversityEmail());
            entity.setContactPhone(optional(request.contactPhone()));
            entity.setRelationshipToStudent(null);
            return;
        }
        entity.setContactName(required(request.contactName(), "Enter the parent or guardian's name."));
        entity.setContactEmail(required(request.contactEmail(), "Enter an email address for the school's reply."));
        entity.setContactPhone(optional(request.contactPhone()));
        entity.setRelationshipToStudent(required(
                request.relationshipToStudent(),
                "Tell us the requester's relationship to the student."
        ));
    }

    private void validateDecision(StudentRequestType type, ReviewDecision decision) {
        if (type == StudentRequestType.LEAVE && decision == ReviewDecision.RESOLVE) {
            throw new ResponseStatusException(BAD_REQUEST, "Approve or decline a leave request.");
        }
        if (type != StudentRequestType.LEAVE && decision == ReviewDecision.APPROVE) {
            throw new ResponseStatusException(BAD_REQUEST, "Resolve or decline this enquiry.");
        }
    }

    private StudentSupportRequest requireForUpdate(UUID requestId) {
        return requestRepository.findByIdForUpdate(requestId).orElseThrow(StudentSupportRequestService::notFound);
    }

    private StudentSupportRequestResponse response(StudentSupportRequest request) {
        boolean lessonTreatmentRequired = request.getType() == StudentRequestType.LEAVE
                && request.getStatus() == StudentRequestStatus.SUBMITTED
                && leaveApprovalService.treatmentRequired(request);
        return responseMapper.toResponse(request, lessonTreatmentRequired);
    }

    private String clean(String value) {
        return value.trim();
    }

    private String required(String value, String message) {
        if (value == null || value.isBlank()) throw new ResponseStatusException(BAD_REQUEST, message);
        return value.trim();
    }

    private String optional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(NOT_FOUND, "Student request not found.");
    }
}
