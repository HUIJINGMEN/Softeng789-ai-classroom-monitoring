package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonMakeupRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonMakeupRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonMakeupRequestDtos.AdminMakeupRequestsResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonMakeupRequestDtos.CreateMakeupRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonMakeupRequestDtos.LessonMakeupRequestResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonMakeupRequestDtos.ReviewDecision;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonMakeupRequestDtos.ReviewMakeupRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.MakeupOptionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ScheduleMakeupRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonMakeupRequestRepository;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
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
public class LessonMakeupRequestService {
    private static final int MAX_PAGE_SIZE = 100;

    private final LessonMakeupRequestRepository requestRepository;
    private final LessonCreditRepository creditRepository;
    private final ClassroomSessionRepository sessionRepository;
    private final TeacherRepository teacherRepository;
    private final LessonCreditManagementService creditService;

    public LessonMakeupRequestService(
            LessonMakeupRequestRepository requestRepository,
            LessonCreditRepository creditRepository,
            ClassroomSessionRepository sessionRepository,
            TeacherRepository teacherRepository,
            LessonCreditManagementService creditService
    ) {
        this.requestRepository = requestRepository;
        this.creditRepository = creditRepository;
        this.sessionRepository = sessionRepository;
        this.teacherRepository = teacherRepository;
        this.creditService = creditService;
    }

    @Transactional(readOnly = true)
    public List<MakeupOptionResponse> options(UUID studentId, UUID creditId) {
        requireOwnedCredit(studentId, creditId);
        return creditService.makeupOptions(creditId);
    }

    @Transactional
    public LessonMakeupRequestResponse submit(UUID studentId, CreateMakeupRequest request) {
        LessonCredit credit = requireOwnedCreditForUpdate(studentId, request.lessonCreditId());
        if (credit.getStatus() != LessonCreditStatus.MAKEUP_DUE) {
            throw new ResponseStatusException(BAD_REQUEST, "This lesson is not waiting for a make-up date.");
        }
        if (requestRepository.existsByLessonCredit_IdAndStatus(
                credit.getId(), LessonMakeupRequestStatus.SUBMITTED
        )) {
            throw new ResponseStatusException(BAD_REQUEST, "A make-up request is already awaiting review.");
        }
        boolean available = creditService.makeupOptions(credit.getId()).stream()
                .anyMatch(option -> option.sessionId().equals(request.preferredSessionId()));
        if (!available) {
            throw new ResponseStatusException(BAD_REQUEST, "That make-up lesson is no longer available.");
        }
        ClassroomSession preferred = sessionRepository.findById(request.preferredSessionId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Replacement session not found."));
        LessonMakeupRequest entity = new LessonMakeupRequest();
        entity.setLessonCredit(credit);
        entity.setStudent(credit.getSessionPackage().getStudent());
        entity.setPreferredSession(preferred);
        entity.setStudentNote(optional(request.note()));
        return response(requestRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<LessonMakeupRequestResponse> studentRequests(UUID studentId) {
        return requestRepository.findByStudent_IdOrderBySubmittedAtDesc(studentId).stream()
                .map(this::response)
                .toList();
    }

    @Transactional
    public LessonMakeupRequestResponse cancel(UUID studentId, UUID requestId) {
        LessonMakeupRequest request = requireRequestForReview(requestId);
        if (!request.getStudent().getId().equals(studentId)) throw notFound();
        if (request.getStatus() != LessonMakeupRequestStatus.SUBMITTED) {
            throw new ResponseStatusException(BAD_REQUEST, "Only a request awaiting review can be withdrawn.");
        }
        request.setStatus(LessonMakeupRequestStatus.CANCELLED);
        request.setReviewedAt(Instant.now());
        return response(requestRepository.save(request));
    }

    @Transactional(readOnly = true)
    public AdminMakeupRequestsResponse adminRequests(
            LessonMakeupRequestStatus status,
            int page,
            int size
    ) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid make-up request page.");
        }
        LessonMakeupRequestStatus selected = status == null
                ? LessonMakeupRequestStatus.SUBMITTED
                : status;
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "submittedAt"));
        Page<LessonMakeupRequest> requests = requestRepository.findByStatus(selected, pageable);
        return new AdminMakeupRequestsResponse(
                requestRepository.countByStatus(LessonMakeupRequestStatus.SUBMITTED),
                PageResponse.from(requests, this::response)
        );
    }

    @Transactional
    public LessonMakeupRequestResponse review(
            UUID adminId,
            UUID requestId,
            ReviewMakeupRequest decision
    ) {
        LessonMakeupRequest request = requireRequestForReview(requestId);
        if (request.getStatus() != LessonMakeupRequestStatus.SUBMITTED) {
            throw new ResponseStatusException(BAD_REQUEST, "This make-up request has already been reviewed.");
        }
        Teacher admin = teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));
        String note = optional(decision.note());
        if (decision.decision() == ReviewDecision.DECLINE && note == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Explain why the requested date cannot be approved.");
        }
        if (decision.decision() == ReviewDecision.APPROVE) {
            creditService.scheduleMakeup(
                    adminId,
                    request.getLessonCredit().getId(),
                    new ScheduleMakeupRequest(request.getPreferredSession().getId())
            );
            request.setStatus(LessonMakeupRequestStatus.APPROVED);
        } else {
            request.setStatus(LessonMakeupRequestStatus.DECLINED);
        }
        request.setReviewNote(note);
        request.setReviewedByAdmin(admin);
        request.setReviewedAt(Instant.now());
        return response(requestRepository.save(request));
    }

    private LessonCredit requireOwnedCredit(UUID studentId, UUID creditId) {
        LessonCredit credit = creditRepository.findDetailedById(creditId).orElseThrow(LessonMakeupRequestService::notFound);
        if (!credit.getSessionPackage().getStudent().getId().equals(studentId)) throw notFound();
        return credit;
    }

    private LessonCredit requireOwnedCreditForUpdate(UUID studentId, UUID creditId) {
        LessonCredit credit = creditRepository.findDetailedByIdForUpdate(creditId)
                .orElseThrow(LessonMakeupRequestService::notFound);
        if (!credit.getSessionPackage().getStudent().getId().equals(studentId)) throw notFound();
        return credit;
    }

    private LessonMakeupRequest requireRequest(UUID requestId) {
        return requestRepository.findById(requestId).orElseThrow(LessonMakeupRequestService::notFound);
    }

    private LessonMakeupRequest requireRequestForReview(UUID requestId) {
        return requestRepository.findByIdForReview(requestId)
                .orElseThrow(LessonMakeupRequestService::notFound);
    }

    private LessonMakeupRequestResponse response(LessonMakeupRequest request) {
        LessonCredit credit = request.getLessonCredit();
        ClassroomSession preferred = request.getPreferredSession();
        Room room = preferred.getRoomEntity();
        var offering = credit.getSessionPackage().getCourseOffering();
        return new LessonMakeupRequestResponse(
                request.getId(), credit.getId(), request.getStudent().getId(), request.getStudent().getFullName(),
                request.getStudent().getStudentNumber(), offering.getId(), offering.getCourse().getCode(),
                credit.getOriginalSession() == null ? null : credit.getOriginalSession().getDate(),
                credit.getExpiresOn(), preferred.getId(), preferred.getDate(), preferred.getStartTime(),
                preferred.getEndTime(), room == null ? preferred.getRoom() : room.getName(),
                room == null ? null : room.getCampus().getName(), request.getStatus(), request.getStudentNote(),
                request.getReviewNote(), request.getSubmittedAt(), request.getReviewedAt()
        );
    }

    private String optional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(NOT_FOUND, "Make-up request not found.");
    }
}
