package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AccomplishmentResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ReviewAccomplishmentCorrectionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Accomplishment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AccomplishmentFeedback;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AccomplishmentFeedbackRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AccomplishmentRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class AccomplishmentFeedbackService {
    private final AccomplishmentRepository accomplishmentRepository;
    private final AccomplishmentFeedbackRepository feedbackRepository;
    private final AccomplishmentService accomplishmentService;
    private final TeacherScopeSupport access;

    public AccomplishmentFeedbackService(
            AccomplishmentRepository accomplishmentRepository,
            AccomplishmentFeedbackRepository feedbackRepository,
            AccomplishmentService accomplishmentService,
            TeacherScopeSupport access
    ) {
        this.accomplishmentRepository = accomplishmentRepository;
        this.feedbackRepository = feedbackRepository;
        this.accomplishmentService = accomplishmentService;
        this.access = access;
    }

    @Transactional
    public AccomplishmentResponse acknowledge(UUID accomplishmentId, UUID studentId) {
        Accomplishment accomplishment = requirePublishedForStudent(accomplishmentId, studentId);
        boolean alreadyAcknowledged = feedbackRepository.existsByAccomplishment_IdAndType(
                accomplishmentId,
                AccomplishmentFeedback.Type.ACKNOWLEDGEMENT
        );
        if (!alreadyAcknowledged) {
            AccomplishmentFeedback acknowledgement = new AccomplishmentFeedback();
            acknowledgement.setAccomplishment(accomplishment);
            acknowledgement.setType(AccomplishmentFeedback.Type.ACKNOWLEDGEMENT);
            acknowledgement.setStatus(AccomplishmentFeedback.Status.RECORDED);
            feedbackRepository.save(acknowledgement);
        }
        return accomplishmentService.responseFor(accomplishment);
    }

    @Transactional
    public AccomplishmentResponse requestCorrection(
            UUID accomplishmentId,
            UUID studentId,
            String message
    ) {
        Accomplishment accomplishment = requirePublishedForStudent(accomplishmentId, studentId);
        boolean hasPendingCorrection = feedbackRepository
                .findFirstByAccomplishment_IdAndTypeAndStatusOrderByCreatedAtDesc(
                        accomplishmentId,
                        AccomplishmentFeedback.Type.CORRECTION_REQUEST,
                        AccomplishmentFeedback.Status.PENDING
                )
                .isPresent();
        if (hasPendingCorrection) {
            throw new ResponseStatusException(
                    CONFLICT,
                    "This accomplishment already has a correction request awaiting review."
            );
        }

        AccomplishmentFeedback correction = new AccomplishmentFeedback();
        correction.setAccomplishment(accomplishment);
        correction.setType(AccomplishmentFeedback.Type.CORRECTION_REQUEST);
        correction.setStatus(AccomplishmentFeedback.Status.PENDING);
        correction.setMessage(message.trim());
        feedbackRepository.save(correction);
        return accomplishmentService.responseFor(accomplishment);
    }

    @Transactional
    public AccomplishmentResponse reviewCorrection(
            UUID accomplishmentId,
            ReviewAccomplishmentCorrectionRequest request,
            UUID callerId
    ) {
        Teacher caller = access.requireCaller(callerId);
        Accomplishment accomplishment = requireAccomplishment(accomplishmentId);
        access.assertCanAccessOffering(accomplishment.getCourseOffering(), caller);
        AccomplishmentFeedback correction = feedbackRepository
                .findFirstByAccomplishment_IdAndTypeAndStatusOrderByCreatedAtDesc(
                        accomplishmentId,
                        AccomplishmentFeedback.Type.CORRECTION_REQUEST,
                        AccomplishmentFeedback.Status.PENDING
                )
                .orElseThrow(() -> new ResponseStatusException(
                        CONFLICT,
                        "This accomplishment has no correction request awaiting review."
                ));

        if (request.decision() == AccomplishmentFeedback.Status.ACCEPTED) {
            applyCorrection(accomplishment, request);
            accomplishmentRepository.save(accomplishment);
        } else if (request.decision() == AccomplishmentFeedback.Status.DECLINED) {
            if (access.blankToNull(request.staffResponse()) == null) {
                throw new ResponseStatusException(
                        BAD_REQUEST,
                        "Explain why the original record is being kept."
                );
            }
        } else {
            throw new ResponseStatusException(BAD_REQUEST, "Decision must be ACCEPTED or DECLINED.");
        }

        correction.setStatus(request.decision());
        correction.setStaffResponse(access.blankToNull(request.staffResponse()));
        correction.setReviewedByTeacher(caller);
        correction.setReviewedAt(Instant.now());
        feedbackRepository.save(correction);
        return accomplishmentService.responseFor(accomplishment);
    }

    private void applyCorrection(
            Accomplishment accomplishment,
            ReviewAccomplishmentCorrectionRequest request
    ) {
        accomplishment.setCategory(request.category());
        accomplishment.setTitle(request.title().trim());
        accomplishment.setDescription(access.blankToNull(request.description()));
        accomplishment.setStudentNote(access.blankToNull(request.studentNote()));
        accomplishment.setPoints(request.points());
        accomplishment.setAchievementDate(request.achievementDate());
        accomplishment.setIncludeInReport(request.includeInReport());
    }

    private Accomplishment requirePublishedForStudent(UUID accomplishmentId, UUID studentId) {
        Accomplishment accomplishment = requireAccomplishment(accomplishmentId);
        if (!accomplishment.getStudent().getId().equals(studentId)) {
            throw new ResponseStatusException(FORBIDDEN, "You can only respond to your own accomplishments.");
        }
        if (accomplishment.getStatus() != Accomplishment.Status.CONFIRMED) {
            throw new ResponseStatusException(CONFLICT, "Only published accomplishments can receive feedback.");
        }
        return accomplishment;
    }

    private Accomplishment requireAccomplishment(UUID accomplishmentId) {
        return accomplishmentRepository.findById(accomplishmentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Accomplishment not found."));
    }
}
