package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AbsenceBillingPolicy;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditEvent;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditEventType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.SessionPackageStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentSessionPackage;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditEventRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AbsenceReason;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class LessonCreditService {
    private final LessonCreditRepository creditRepository;
    private final LessonCreditEventRepository eventRepository;
    private final ClassroomSessionRepository sessionRepository;
    private final AttendanceRecordRepository attendanceRepository;

    public LessonCreditService(
            LessonCreditRepository creditRepository,
            LessonCreditEventRepository eventRepository,
            ClassroomSessionRepository sessionRepository,
            AttendanceRecordRepository attendanceRepository
    ) {
        this.creditRepository = creditRepository;
        this.eventRepository = eventRepository;
        this.sessionRepository = sessionRepository;
        this.attendanceRepository = attendanceRepository;
    }

    @Transactional
    public void createForPackages(Collection<StudentSessionPackage> packages) {
        List<LessonCredit> created = new ArrayList<>();
        for (StudentSessionPackage sessionPackage : packages) {
            for (int index = 0; index < sessionPackage.getPurchasedSessions(); index++) {
                LessonCredit credit = new LessonCredit();
                credit.setSessionPackage(sessionPackage);
                credit.setSequenceNumber(index + 1);
                credit.setExpiresOn(sessionPackage.getServiceTo());
                credit.setStatus(LessonCreditStatus.PENDING_PAYMENT);
                created.add(credit);
            }
        }
        List<LessonCredit> saved = creditRepository.saveAll(created);
        eventRepository.saveAll(saved.stream().map(credit -> event(
                credit,
                LessonCreditEventType.CREATED,
                null,
                credit.getStatus(),
                credit.getOriginalSession(),
                credit.getCurrentSession(),
                "Lesson credit created and held until payment is confirmed.",
                null
        )).toList());
    }

    /**
     * Activates exactly one paid purchase lot, then reconciles the student's whole course account
     * under a pessimistic account lock. Looking at every lot together is what prevents a later
     * 20-lesson purchase from booking the same sessions as an earlier 10-lesson purchase.
     */
    @Transactional
    public void activatePackage(StudentSessionPackage sessionPackage) {
        List<LessonCredit> account = creditRepository.findAccountCreditsForUpdate(
                sessionPackage.getStudent().getId(),
                sessionPackage.getCourseOffering().getId()
        );
        account.stream()
                .filter(credit -> credit.getSessionPackage().getId().equals(sessionPackage.getId()))
                .filter(credit -> credit.getStatus() == LessonCreditStatus.PENDING_PAYMENT)
                .forEach(credit -> transition(
                        credit,
                        LessonCreditStatus.AVAILABLE,
                        LessonCreditEventType.PAYMENT_ACTIVATED,
                        null,
                        null,
                        "Payment confirmed; lesson credit is now available.",
                        null
                ));
        reconcileAccount(account);
    }

    @Transactional
    public void pausePackage(StudentSessionPackage sessionPackage, Teacher admin, String reason) {
        List<LessonCredit> credits = creditRepository
                .findBySessionPackage_IdInOrderBySessionPackage_IdAscSequenceNumberAsc(List.of(sessionPackage.getId()));
        for (LessonCredit credit : credits) {
            if (credit.getStatus() == LessonCreditStatus.BOOKED) {
                ClassroomSession released = credit.getCurrentSession();
                credit.setCurrentSession(null);
                credit.setOriginalSession(null);
                transition(credit, LessonCreditStatus.AVAILABLE, LessonCreditEventType.MANUAL_ADJUSTMENT,
                        released, null, "Package paused: " + reason, admin);
            } else if (credit.getStatus() == LessonCreditStatus.MAKEUP_SCHEDULED) {
                ClassroomSession released = credit.getCurrentSession();
                credit.setCurrentSession(credit.getOriginalSession());
                transition(credit, LessonCreditStatus.MAKEUP_DUE, LessonCreditEventType.MANUAL_ADJUSTMENT,
                        released, credit.getOriginalSession(), "Package paused; make-up booking released: " + reason, admin);
            }
        }
    }

    @Transactional
    public void extendPackage(StudentSessionPackage sessionPackage, Teacher admin, String reason) {
        List<LessonCredit> credits = creditRepository
                .findBySessionPackage_IdInOrderBySessionPackage_IdAscSequenceNumberAsc(List.of(sessionPackage.getId()));
        for (LessonCredit credit : credits) {
            if (credit.getStatus() == LessonCreditStatus.USED
                    || credit.getStatus() == LessonCreditStatus.COUNTED_ABSENCE
                    || credit.getStatus() == LessonCreditStatus.VOID) {
                continue;
            }
            credit.setExpiresOn(sessionPackage.getServiceTo());
            if (credit.getStatus() == LessonCreditStatus.EXPIRED
                    && !sessionPackage.getServiceTo().isBefore(BillingDates.today())) {
                transition(credit, LessonCreditStatus.AVAILABLE, LessonCreditEventType.MANUAL_ADJUSTMENT,
                        null, null, "Expired credit restored after package extension: " + reason, admin);
            } else {
                creditRepository.save(credit);
            }
        }
        if (sessionPackage.getStatus() == SessionPackageStatus.ACTIVE) reconcilePackage(sessionPackage);
    }

    @Transactional
    public void cancelPackage(StudentSessionPackage sessionPackage, Teacher admin, String reason) {
        List<LessonCredit> credits = creditRepository
                .findBySessionPackage_IdInOrderBySessionPackage_IdAscSequenceNumberAsc(List.of(sessionPackage.getId()));
        for (LessonCredit credit : credits) {
            if (credit.getStatus() == LessonCreditStatus.USED
                    || credit.getStatus() == LessonCreditStatus.COUNTED_ABSENCE
                    || credit.getStatus() == LessonCreditStatus.VOID) {
                continue;
            }
            ClassroomSession released = credit.getCurrentSession();
            credit.setCurrentSession(null);
            transition(credit, LessonCreditStatus.VOID, LessonCreditEventType.MANUAL_ADJUSTMENT,
                    released, null, "Package cancelled: " + reason, admin);
        }
    }

    @Transactional
    public void preparePackageTransfer(StudentSessionPackage sessionPackage, Teacher admin, String reason) {
        List<LessonCredit> credits = creditRepository
                .findBySessionPackage_IdInOrderBySessionPackage_IdAscSequenceNumberAsc(List.of(sessionPackage.getId()));
        boolean hasOpenMakeup = credits.stream().anyMatch(credit ->
                credit.getStatus() == LessonCreditStatus.MAKEUP_DUE
                        || credit.getStatus() == LessonCreditStatus.MAKEUP_SCHEDULED);
        if (hasOpenMakeup) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Resolve the student's open make-up lessons before transferring this package.");
        }
        for (LessonCredit credit : credits) {
            if (credit.getStatus() == LessonCreditStatus.BOOKED
                    || credit.getStatus() == LessonCreditStatus.AVAILABLE
                    || credit.getStatus() == LessonCreditStatus.EXPIRED) {
                ClassroomSession released = credit.getCurrentSession();
                credit.setCurrentSession(null);
                credit.setOriginalSession(null);
                if (credit.getStatus() == LessonCreditStatus.EXPIRED
                        && sessionPackage.getServiceTo().isBefore(BillingDates.today())) {
                    creditRepository.save(credit);
                } else {
                    LessonCreditStatus previous = credit.getStatus();
                    transition(credit, LessonCreditStatus.AVAILABLE, LessonCreditEventType.MANUAL_ADJUSTMENT,
                            released, null, "Remaining lesson transferred to another class: " + reason, admin);
                    if (previous == LessonCreditStatus.AVAILABLE) creditRepository.save(credit);
                }
            }
        }
    }

    @Transactional
    public void reconcilePackage(StudentSessionPackage sessionPackage) {
        reconcileAccount(creditRepository.findAccountCreditsForUpdate(
                sessionPackage.getStudent().getId(), sessionPackage.getCourseOffering().getId()
        ));
    }

    @Transactional
    public List<LessonCredit> creditsForPackages(Collection<UUID> packageIds) {
        if (packageIds.isEmpty()) return List.of();
        List<LessonCredit> credits = creditRepository
                .findBySessionPackage_IdInOrderBySessionPackage_IdAscSequenceNumberAsc(packageIds);
        Set<String> refreshed = new HashSet<>();
        for (LessonCredit credit : credits) {
            UUID studentId = credit.getSessionPackage().getStudent().getId();
            UUID offeringId = credit.getSessionPackage().getCourseOffering().getId();
            if (refreshed.add(key(studentId, offeringId))) {
                reconcileAccount(creditRepository.findAccountCreditsForUpdate(studentId, offeringId));
            }
        }
        return creditRepository.findBySessionPackage_IdInOrderBySessionPackage_IdAscSequenceNumberAsc(packageIds);
    }

    private void synchronize(List<LessonCredit> credits) {
        List<UUID> studentIds = credits.stream()
                .map(credit -> credit.getSessionPackage().getStudent().getId())
                .distinct()
                .toList();
        List<UUID> sessionIds = credits.stream()
                .map(LessonCredit::getCurrentSession)
                .filter(Objects::nonNull)
                .map(ClassroomSession::getId)
                .distinct()
                .toList();
        Map<String, AttendanceRecord> attendance = new HashMap<>();
        if (!studentIds.isEmpty() && !sessionIds.isEmpty()) {
            attendanceRepository.findByStudent_IdInAndSession_IdIn(studentIds, sessionIds)
                    .forEach(record -> attendance.put(key(
                            record.getStudent().getId(), record.getSession().getId()
                    ), record));
        }
        for (LessonCredit credit : credits) {
            synchronize(credit, credit.getCurrentSession() == null ? null : attendance.get(key(
                    credit.getSessionPackage().getStudent().getId(), credit.getCurrentSession().getId()
            )));
        }
    }

    private void synchronize(LessonCredit credit, AttendanceRecord attendance) {
        LessonCreditStatus current = credit.getStatus();
        if (current == LessonCreditStatus.PENDING_PAYMENT
                || current == LessonCreditStatus.USED
                || current == LessonCreditStatus.COUNTED_ABSENCE
                || current == LessonCreditStatus.VOID
                || current == LessonCreditStatus.EXPIRED
                || current == LessonCreditStatus.MAKEUP_DUE) {
            return;
        }
        ClassroomSession session = credit.getCurrentSession();
        if (session == null) {
            if (credit.getExpiresOn().isBefore(BillingDates.today())) {
                transition(credit, LessonCreditStatus.EXPIRED, LessonCreditEventType.MANUAL_ADJUSTMENT,
                        null, null, "Unused lesson credit expired.", null);
            }
            return;
        }
        if (session.getStatus() == SessionStatus.CANCELLED) {
            credit.setAbsenceReason(AbsenceReason.SCHOOL_CANCELLED);
            credit.setCurrentSession(null);
            transition(credit, LessonCreditStatus.AVAILABLE, LessonCreditEventType.SESSION_CANCELLED,
                    session, null, "The scheduled class was cancelled; the lesson credit remains available.", null);
            return;
        }
        if (attendance == null || attendance.getStatus() == AttendanceStatus.UNKNOWN) return;
        credit.setSourceAttendanceRecord(attendance);
        if (attendance.getStatus() == AttendanceStatus.PRESENT || attendance.getStatus() == AttendanceStatus.LATE) {
            transition(
                    credit,
                    LessonCreditStatus.USED,
                    current == LessonCreditStatus.MAKEUP_SCHEDULED
                            ? LessonCreditEventType.MAKEUP_COMPLETED
                            : LessonCreditEventType.ATTENDANCE_RECORDED,
                    credit.getOriginalSession(),
                    session,
                    current == LessonCreditStatus.MAKEUP_SCHEDULED
                            ? "Student attended the scheduled make-up."
                            : "Student attended the booked lesson.",
                    null
            );
            return;
        }
        if (attendance.getStatus() == AttendanceStatus.ABSENT) {
            credit.setAbsenceReason(attendance.getAbsenceReason());
            credit.setDecisionNote(attendance.getAbsenceNote());
            boolean consumes = current == LessonCreditStatus.MAKEUP_SCHEDULED
                    || credit.getSessionPackage().getAbsencePolicy() == AbsenceBillingPolicy.CONSUME_UNEXCUSED;
            transition(
                    credit,
                    consumes ? LessonCreditStatus.COUNTED_ABSENCE : LessonCreditStatus.MAKEUP_DUE,
                    consumes ? LessonCreditEventType.ABSENCE_COUNTED : LessonCreditEventType.MAKEUP_APPROVED,
                    session,
                    null,
                    consumes ? "Recorded absence counted under the package policy."
                            : "Recorded absence retained as an available make-up.",
                    null
            );
        }
    }

    private void reconcileAccount(List<LessonCredit> account) {
        synchronize(account);
        allocateAvailableCredits(account);
        synchronize(account);
    }

    /** Assigns active credits FIFO to the earliest uncovered session inside each purchase lot's
     * service window. A credit released by a cancelled session keeps its original session and is
     * therefore visibly linked to the later replacement date. */
    private void allocateAvailableCredits(List<LessonCredit> account) {
        Set<UUID> coveredSessionIds = account.stream()
                .filter(credit -> credit.getStatus() != LessonCreditStatus.PENDING_PAYMENT)
                .filter(credit -> credit.getStatus() != LessonCreditStatus.VOID)
                .map(LessonCredit::getCurrentSession)
                .filter(Objects::nonNull)
                .map(ClassroomSession::getId)
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        for (LessonCredit credit : account) {
            if (credit.getStatus() != LessonCreditStatus.AVAILABLE
                    || credit.getSessionPackage().getStatus() != SessionPackageStatus.ACTIVE) {
                continue;
            }
            if (credit.getExpiresOn().isBefore(BillingDates.today())) {
                transition(credit, LessonCreditStatus.EXPIRED, LessonCreditEventType.MANUAL_ADJUSTMENT,
                        null, null, "Unused lesson credit expired.", null);
                continue;
            }
            StudentSessionPackage sessionPackage = credit.getSessionPackage();
            ClassroomSession target = sessionRepository
                    .findByCourseOffering_IdAndDateBetweenOrderByDateAscStartTimeAsc(
                            sessionPackage.getCourseOffering().getId(),
                            sessionPackage.getServiceFrom(),
                            sessionPackage.getServiceTo()
                    ).stream()
                    .filter(session -> session.getStatus() != SessionStatus.CANCELLED)
                    .filter(session -> !coveredSessionIds.contains(session.getId()))
                    .findFirst()
                    .orElse(null);
            if (target == null) continue;

            LessonCreditStatus next = credit.getOriginalSession() == null
                    ? LessonCreditStatus.BOOKED
                    : LessonCreditStatus.MAKEUP_SCHEDULED;
            if (credit.getOriginalSession() == null) credit.setOriginalSession(target);
            credit.setCurrentSession(target);
            coveredSessionIds.add(target.getId());
            transition(
                    credit,
                    next,
                    next == LessonCreditStatus.BOOKED
                            ? LessonCreditEventType.LESSON_BOOKED
                            : LessonCreditEventType.MAKEUP_SCHEDULED,
                    credit.getOriginalSession(),
                    target,
                    next == LessonCreditStatus.BOOKED
                            ? "Lesson credit assigned to the next uncovered class."
                            : "Released lesson credit moved to the next uncovered class.",
                    null
            );
        }
    }

    private void transition(
            LessonCredit credit,
            LessonCreditStatus next,
            LessonCreditEventType type,
            ClassroomSession source,
            ClassroomSession target,
            String note,
            Teacher actor
    ) {
        LessonCreditStatus previous = credit.getStatus();
        if (previous == next) return;
        credit.setStatus(next);
        creditRepository.save(credit);
        eventRepository.save(event(credit, type, previous, next, source, target, note, actor));
    }

    private LessonCreditEvent event(
            LessonCredit credit,
            LessonCreditEventType type,
            LessonCreditStatus from,
            LessonCreditStatus to,
            ClassroomSession source,
            ClassroomSession target,
            String note,
            Teacher actor
    ) {
        LessonCreditEvent result = new LessonCreditEvent();
        result.setLessonCredit(credit);
        result.setEventType(type);
        result.setFromStatus(from);
        result.setToStatus(to);
        result.setSourceSession(source);
        result.setTargetSession(target);
        result.setNote(note);
        result.setActor(actor);
        return result;
    }

    private static String key(UUID studentId, UUID sessionId) {
        return studentId + ":" + sessionId;
    }

}
