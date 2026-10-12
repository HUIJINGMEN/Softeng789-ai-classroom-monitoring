package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AttendanceBillingDecision;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditEvent;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditEventType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonCreditDetailResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonCreditEventResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonDecision;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonDecisionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.MakeupOptionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ScheduleMakeupRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditEventRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AbsenceReason;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/** Admin decisions and make-up booking workflow for an existing lesson credit. */
@Service
public class LessonCreditManagementService {
    private static final Set<LessonCreditStatus> RESERVED_SEAT_STATUSES = Set.of(
            LessonCreditStatus.BOOKED,
            LessonCreditStatus.MAKEUP_SCHEDULED
    );
    private static final Set<LessonCreditStatus> LEAVE_DECISION_STATUSES = Set.of(
            LessonCreditStatus.BOOKED,
            LessonCreditStatus.MAKEUP_SCHEDULED,
            LessonCreditStatus.COUNTED_ABSENCE,
            LessonCreditStatus.MAKEUP_DUE
    );

    private final LessonCreditRepository creditRepository;
    private final LessonCreditEventRepository eventRepository;
    private final ClassroomSessionRepository sessionRepository;
    private final AttendanceRecordRepository attendanceRepository;
    private final TeacherRepository teacherRepository;

    public LessonCreditManagementService(
            LessonCreditRepository creditRepository,
            LessonCreditEventRepository eventRepository,
            ClassroomSessionRepository sessionRepository,
            AttendanceRecordRepository attendanceRepository,
            TeacherRepository teacherRepository
    ) {
        this.creditRepository = creditRepository;
        this.eventRepository = eventRepository;
        this.sessionRepository = sessionRepository;
        this.attendanceRepository = attendanceRepository;
        this.teacherRepository = teacherRepository;
    }

    @Transactional
    public LessonCreditDetailResponse decide(UUID adminId, UUID creditId, LessonDecisionRequest request) {
        LessonCredit credit = requireCreditForUpdate(creditId);
        AttendanceRecord absence = attendanceForCurrentSession(credit);
        if (absence == null || absence.getStatus() != AttendanceStatus.ABSENT) {
            throw new ResponseStatusException(BAD_REQUEST, "A make-up decision requires a recorded absence.");
        }
        Teacher admin = requireAdmin(adminId);
        LessonCreditStatus previous = credit.getStatus();
        LessonCreditStatus next = request.decision() == LessonDecision.GRANT_MAKEUP
                ? LessonCreditStatus.MAKEUP_DUE
                : LessonCreditStatus.COUNTED_ABSENCE;
        credit.setStatus(next);
        credit.setSourceAttendanceRecord(absence);
        credit.setAbsenceReason(request.reason());
        credit.setDecisionNote(request.note().trim());
        credit.setDecidedByAdmin(admin);
        absence.setAbsenceReason(request.reason());
        absence.setAbsenceNote(request.note().trim());
        attendanceRepository.save(absence);
        saveEvent(
                credit,
                request.decision() == LessonDecision.GRANT_MAKEUP
                        ? LessonCreditEventType.MAKEUP_APPROVED
                        : LessonCreditEventType.ABSENCE_COUNTED,
                previous,
                next,
                credit.getCurrentSession(),
                null,
                request.note().trim(),
                admin
        );
        return detail(credit);
    }

    @Transactional
    public LessonCreditDetailResponse scheduleMakeup(
            UUID adminId,
            UUID creditId,
            ScheduleMakeupRequest request
    ) {
        LessonCredit credit = requireCreditForUpdate(creditId);
        requireMakeupEligible(credit);
        if (credit.getStatus() == LessonCreditStatus.MAKEUP_SCHEDULED
                && credit.getCurrentSession() != null
                && credit.getCurrentSession().getId().equals(request.targetSessionId())) {
            return detail(credit);
        }
        ClassroomSession target = requireBookableTarget(credit, request.targetSessionId());
        assertSessionNotCovered(credit, target);
        assertCapacityAvailable(target);

        Teacher admin = requireAdmin(adminId);
        ClassroomSession source = credit.getCurrentSession();
        LessonCreditStatus previous = credit.getStatus();
        credit.setCurrentSession(target);
        credit.setStatus(LessonCreditStatus.MAKEUP_SCHEDULED);
        credit.setDecidedByAdmin(admin);
        saveEvent(
                credit,
                previous == LessonCreditStatus.MAKEUP_SCHEDULED
                        ? LessonCreditEventType.MAKEUP_RESCHEDULED
                        : LessonCreditEventType.MAKEUP_SCHEDULED,
                previous,
                LessonCreditStatus.MAKEUP_SCHEDULED,
                source,
                target,
                previous == LessonCreditStatus.MAKEUP_SCHEDULED
                        ? "Make-up session changed."
                        : "Make-up session scheduled.",
                admin
        );
        return detail(credit);
    }

    @Transactional
    public LessonCreditDetailResponse cancelMakeup(UUID adminId, UUID creditId) {
        LessonCredit credit = requireCreditForUpdate(creditId);
        if (credit.getStatus() != LessonCreditStatus.MAKEUP_SCHEDULED) {
            throw new ResponseStatusException(BAD_REQUEST, "This lesson credit has no make-up booking to cancel.");
        }
        Teacher admin = requireAdmin(adminId);
        ClassroomSession cancelledTarget = credit.getCurrentSession();
        credit.setCurrentSession(credit.getOriginalSession());
        credit.setStatus(LessonCreditStatus.MAKEUP_DUE);
        credit.setDecidedByAdmin(admin);
        saveEvent(
                credit,
                LessonCreditEventType.MAKEUP_CANCELLED,
                LessonCreditStatus.MAKEUP_SCHEDULED,
                LessonCreditStatus.MAKEUP_DUE,
                cancelledTarget,
                credit.getOriginalSession(),
                "Make-up booking cancelled; a new date is still required.",
                admin
        );
        return detail(credit);
    }

    @Transactional
    public void applyLegacyBillingOverride(
            UUID packageId,
            AttendanceRecord attendance,
            AttendanceBillingDecision decision,
            String reason,
            Teacher admin
    ) {
        creditRepository.findBySessionPackage_IdInOrderBySessionPackage_IdAscSequenceNumberAsc(List.of(packageId))
                .stream()
                .filter(credit -> credit.getCurrentSession() != null
                        && credit.getCurrentSession().getId().equals(attendance.getSession().getId()))
                .findFirst()
                .ifPresent(credit -> applyLegacyDecision(credit, attendance, decision, reason, admin));
    }

    @Transactional(readOnly = true)
    public List<MakeupOptionResponse> makeupOptions(UUID creditId) {
        LessonCredit credit = requireCredit(creditId);
        if (credit.getStatus() != LessonCreditStatus.MAKEUP_DUE
                && credit.getStatus() != LessonCreditStatus.MAKEUP_SCHEDULED) {
            throw new ResponseStatusException(BAD_REQUEST, "This lesson credit is not eligible for make-up scheduling.");
        }
        List<ClassroomSession> sessions = eligibleSessions(credit);
        if (sessions.isEmpty()) return List.of();
        Map<UUID, Long> reservedSeats = reservedSeatsFor(sessions);
        return sessions.stream()
                .filter(session -> hasCapacity(session, reservedSeats.getOrDefault(session.getId(), 0L)))
                .map(session -> option(session, reservedSeats.getOrDefault(session.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public LessonCreditDetailResponse detail(UUID creditId) {
        return detail(requireCredit(creditId));
    }

    @Transactional(readOnly = true)
    public Optional<UUID> decisionCreditIdForLesson(UUID studentId, UUID sessionId) {
        List<LessonCredit> candidates = creditRepository
                .findBySessionPackage_Student_IdAndCurrentSession_IdOrderBySessionPackage_CreatedAtAscSequenceNumberAsc(
                        studentId,
                        sessionId
                ).stream()
                .filter(credit -> LEAVE_DECISION_STATUSES.contains(credit.getStatus()))
                .toList();
        if (candidates.size() > 1) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "More than one lesson credit covers this lesson. Reconcile the lesson account before approving leave.");
        }
        return candidates.stream().findFirst().map(LessonCredit::getId);
    }

    private void requireMakeupEligible(LessonCredit credit) {
        if (credit.getStatus() != LessonCreditStatus.MAKEUP_DUE
                && credit.getStatus() != LessonCreditStatus.MAKEUP_SCHEDULED) {
            throw new ResponseStatusException(BAD_REQUEST, "This lesson credit cannot be scheduled for a make-up.");
        }
    }

    private ClassroomSession requireBookableTarget(LessonCredit credit, UUID targetSessionId) {
        ClassroomSession target = sessionRepository.findForUpdateById(targetSessionId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Replacement session not found."));
        boolean sameClass = target.getCourseOffering() != null
                && target.getCourseOffering().getId().equals(credit.getSessionPackage().getCourseOffering().getId());
        boolean bookable = target.getStatus() == SessionStatus.SCHEDULED || target.getStatus() == SessionStatus.ACTIVE;
        if (!sameClass || !bookable || target.getDate().isBefore(BillingDates.today())) {
            throw new ResponseStatusException(BAD_REQUEST, "Select an upcoming session from the same class.");
        }
        if (target.getDate().isAfter(credit.getExpiresOn())) {
            throw new ResponseStatusException(BAD_REQUEST, "Select a make-up lesson on or before the credit expiry date.");
        }
        return target;
    }

    private void assertSessionNotCovered(LessonCredit credit, ClassroomSession target) {
        boolean alreadyCovered = creditRepository.findAccountCreditsForUpdate(
                        credit.getSessionPackage().getStudent().getId(),
                        credit.getSessionPackage().getCourseOffering().getId()
                ).stream()
                .filter(item -> !item.getId().equals(credit.getId()))
                .map(LessonCredit::getCurrentSession)
                .filter(Objects::nonNull)
                .anyMatch(session -> session.getId().equals(target.getId()));
        if (alreadyCovered) {
            throw new ResponseStatusException(BAD_REQUEST, "This lesson is already covered by another credit.");
        }
    }

    private void applyLegacyDecision(
            LessonCredit credit,
            AttendanceRecord attendance,
            AttendanceBillingDecision decision,
            String reason,
            Teacher admin
    ) {
        LessonCreditStatus previous = credit.getStatus();
        LessonCreditStatus next = decision == AttendanceBillingDecision.WAIVE
                ? LessonCreditStatus.MAKEUP_DUE
                : LessonCreditStatus.COUNTED_ABSENCE;
        credit.setStatus(next);
        credit.setSourceAttendanceRecord(attendance);
        credit.setAbsenceReason(AbsenceReason.OTHER);
        credit.setDecisionNote(reason);
        credit.setDecidedByAdmin(admin);
        attendance.setAbsenceReason(AbsenceReason.OTHER);
        attendance.setAbsenceNote(reason);
        attendanceRepository.save(attendance);
        saveEvent(
                credit,
                decision == AttendanceBillingDecision.WAIVE
                        ? LessonCreditEventType.MAKEUP_APPROVED
                        : LessonCreditEventType.ABSENCE_COUNTED,
                previous,
                next,
                attendance.getSession(),
                null,
                reason,
                admin
        );
    }

    private List<ClassroomSession> eligibleSessions(LessonCredit credit) {
        UUID offeringId = credit.getSessionPackage().getCourseOffering().getId();
        LocalDate from = BillingDates.today();
        LocalDate to = credit.getExpiresOn().isBefore(from.plusDays(60))
                ? credit.getExpiresOn()
                : from.plusDays(60);
        if (to.isBefore(from)) return List.of();

        Set<UUID> coveredSessionIds = creditRepository
                .findBySessionPackage_Student_IdAndSessionPackage_CourseOffering_Id(
                        credit.getSessionPackage().getStudent().getId(), offeringId
                ).stream()
                .filter(item -> !item.getId().equals(credit.getId()))
                .map(LessonCredit::getCurrentSession)
                .filter(Objects::nonNull)
                .map(ClassroomSession::getId)
                .collect(java.util.stream.Collectors.toSet());
        return sessionRepository.findByCourseOffering_IdAndDateBetweenOrderByDateAscStartTimeAsc(offeringId, from, to)
                .stream()
                .filter(session -> session.getStatus() == SessionStatus.SCHEDULED
                        || session.getStatus() == SessionStatus.ACTIVE)
                .filter(session -> credit.getCurrentSession() == null
                        || !session.getId().equals(credit.getCurrentSession().getId()))
                .filter(session -> !coveredSessionIds.contains(session.getId()))
                .toList();
    }

    private Map<UUID, Long> reservedSeatsFor(List<ClassroomSession> sessions) {
        return creditRepository.findReservedSeatCounts(
                        sessions.stream().map(ClassroomSession::getId).toList(),
                        RESERVED_SEAT_STATUSES
                ).stream()
                .collect(java.util.stream.Collectors.toMap(
                        LessonCreditRepository.ReservedSeatCount::getSessionId,
                        LessonCreditRepository.ReservedSeatCount::getReservedSeats
                ));
    }

    private MakeupOptionResponse option(ClassroomSession session, long reservedSeats) {
        Room room = session.getRoomEntity();
        return new MakeupOptionResponse(
                session.getId(),
                session.getDate(),
                session.getStartTime(),
                session.getEndTime(),
                room == null ? session.getRoom() : room.getName(),
                room == null ? null : room.getCampus().getName(),
                room == null ? 0 : room.getCapacity(),
                reservedSeats
        );
    }

    private void assertCapacityAvailable(ClassroomSession session) {
        if (!hasCapacity(session, creditRepository.countReservedSeats(session.getId(), RESERVED_SEAT_STATUSES))) {
            throw new ResponseStatusException(BAD_REQUEST, "This lesson is full. Choose another make-up date.");
        }
    }

    private boolean hasCapacity(ClassroomSession session, long reservedSeats) {
        Room room = session.getRoomEntity();
        return room == null || room.getCapacity() <= 0 || reservedSeats < room.getCapacity();
    }

    private AttendanceRecord attendanceForCurrentSession(LessonCredit credit) {
        if (credit.getCurrentSession() == null) return null;
        return attendanceRepository.findBySession_IdAndStudent_Id(
                credit.getCurrentSession().getId(), credit.getSessionPackage().getStudent().getId()
        ).orElse(null);
    }

    private void saveEvent(
            LessonCredit credit,
            LessonCreditEventType type,
            LessonCreditStatus from,
            LessonCreditStatus to,
            ClassroomSession source,
            ClassroomSession target,
            String note,
            Teacher actor
    ) {
        creditRepository.save(credit);
        LessonCreditEvent event = new LessonCreditEvent();
        event.setLessonCredit(credit);
        event.setEventType(type);
        event.setFromStatus(from);
        event.setToStatus(to);
        event.setSourceSession(source);
        event.setTargetSession(target);
        event.setNote(note);
        event.setActor(actor);
        eventRepository.save(event);
    }

    private LessonCreditDetailResponse detail(LessonCredit credit) {
        return new LessonCreditDetailResponse(
                credit.getId(),
                credit.getStatus(),
                credit.getAbsenceReason(),
                credit.getDecisionNote(),
                id(credit.getOriginalSession()),
                date(credit.getOriginalSession()),
                id(credit.getCurrentSession()),
                date(credit.getCurrentSession()),
                eventRepository.findByLessonCredit_IdOrderByCreatedAtAsc(credit.getId()).stream()
                        .map(this::toEventResponse)
                        .toList()
        );
    }

    private LessonCreditEventResponse toEventResponse(LessonCreditEvent event) {
        return new LessonCreditEventResponse(
                event.getId(),
                event.getEventType(),
                event.getFromStatus(),
                event.getToStatus(),
                id(event.getSourceSession()),
                date(event.getSourceSession()),
                id(event.getTargetSession()),
                date(event.getTargetSession()),
                event.getNote(),
                event.getActor() == null ? null : event.getActor().getName(),
                event.getCreatedAt()
        );
    }

    private LessonCredit requireCredit(UUID id) {
        return creditRepository.findDetailedById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Lesson credit not found."));
    }

    private LessonCredit requireCreditForUpdate(UUID id) {
        return creditRepository.findDetailedByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Lesson credit not found."));
    }

    private Teacher requireAdmin(UUID adminId) {
        return teacherRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Administrator not found."));
    }

    private static UUID id(ClassroomSession session) {
        return session == null ? null : session.getId();
    }

    private static LocalDate date(ClassroomSession session) {
        return session == null ? null : session.getDate();
    }
}
