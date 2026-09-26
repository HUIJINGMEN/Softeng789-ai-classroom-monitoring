package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.BehaviourEventResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.ReviewBehaviourEventRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.BehaviourEvent;
import io.github.huijingmen.softeng789.classroommonitoring.entity.BehaviourEvent.ReviewStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.BehaviourEventRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class BehaviourEventService {
    private final BehaviourEventRepository behaviourEventRepository;
    private final TeacherScopeSupport access;

    public BehaviourEventService(
            BehaviourEventRepository behaviourEventRepository,
            TeacherScopeSupport access
    ) {
        this.behaviourEventRepository = behaviourEventRepository;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<BehaviourEventResponse> listEvents(UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        List<BehaviourEvent> events = access.isAdmin(caller)
                ? behaviourEventRepository.findAllByOrderByTimestampDesc()
                : behaviourEventRepository
                        .findBySession_CourseOffering_Teachers_IdOrderByTimestampDesc(callerId);
        return events.stream().map(event -> toResponse(event, null)).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<BehaviourEventResponse> listEvents(UUID callerId, int page, int size) {
        return listEvents(callerId, page, size, null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public PageResponse<BehaviourEventResponse> listEvents(
            UUID callerId,
            int page,
            int size,
            String reviewStatus,
            String course,
            UUID sessionId,
            String eventType,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        Teacher caller = access.requireCaller(callerId);
        var pageRequest = PageRequestSupport.create(page, size);
        ReviewStatus parsedStatus = parseReviewStatus(reviewStatus);
        Page<BehaviourEvent> events = behaviourEventRepository.findAll(
                BehaviourEventSpecifications.visibleDirectory(
                        callerId,
                        access.isAdmin(caller),
                        parsedStatus,
                        course,
                        sessionId,
                        eventType,
                        dateFrom,
                        dateTo
                ),
                pageRequest
        );
        return PageResponse.from(events, event -> toResponse(event, null));
    }

    private ReviewStatus parseReviewStatus(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return ReviewStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Unsupported review status.");
        }
    }

    @Transactional
    public BehaviourEventResponse reviewEvent(
            UUID eventId,
            UUID callerId,
            ReviewBehaviourEventRequest request
    ) {
        Teacher caller = access.requireCaller(callerId);
        BehaviourEvent event = behaviourEventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "AI event not found."));
        access.assertCanAccessOffering(event.getSession().getCourseOffering(), caller);

        if (request == null || request.status() == null || request.status().isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "A review status is required.");
        }

        ReviewStatus nextStatus;
        try {
            nextStatus = ReviewStatus.valueOf(request.status().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Unsupported review status.");
        }
        if (nextStatus == ReviewStatus.PENDING_REVIEW) {
            throw new ResponseStatusException(BAD_REQUEST, "A reviewed event cannot be returned to pending.");
        }

        String correctedFrom = null;
        if (nextStatus == ReviewStatus.CORRECTED) {
            if (request.eventType() == null || request.eventType().isBlank()) {
                throw new ResponseStatusException(BAD_REQUEST, "Choose the corrected event type.");
            }
            correctedFrom = event.getEventType();
            event.setEventType(request.eventType().trim());
        }
        event.setReviewStatus(nextStatus);
        return toResponse(behaviourEventRepository.save(event), correctedFrom);
    }

    private BehaviourEventResponse toResponse(BehaviourEvent event, String correctedFrom) {
        Student student = event.getStudent();
        String trackId = student == null
                ? "Unlinked track"
                : "Seat " + (student.getSeat().isBlank() ? student.getStudentNumber() : student.getSeat());
        int durationSeconds = 35 + Math.floorMod(event.getId().hashCode(), 56);
        return new BehaviourEventResponse(
                event.getId(),
                student == null ? null : student.getId(),
                trackId,
                event.getEventType(),
                event.getSession().getId(),
                event.getTimestamp(),
                durationSeconds,
                event.getConfidence(),
                event.getReviewStatus(),
                correctedFrom
        );
    }
}
