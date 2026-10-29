package io.github.huijingmen.softeng789.classroommonitoring.support.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonDecision;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonDecisionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.LessonCreditManagementService;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateAttendanceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AbsenceReason;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.AttendanceService;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.LeaveLessonTreatment;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.LeaveReason;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentSupportRequest;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** Coordinates leave approval without moving attendance or billing rules into the request module. */
@Service
public class LeaveRequestApprovalService {
    private static final int ATTENDANCE_NOTE_LIMIT = 500;

    private final AttendanceService attendanceService;
    private final AttendanceRecordRepository attendanceRepository;
    private final LessonCreditManagementService lessonCreditManagementService;

    public LeaveRequestApprovalService(
            AttendanceService attendanceService,
            AttendanceRecordRepository attendanceRepository,
            LessonCreditManagementService lessonCreditManagementService
    ) {
        this.attendanceService = attendanceService;
        this.attendanceRepository = attendanceRepository;
        this.lessonCreditManagementService = lessonCreditManagementService;
    }

    @Transactional(readOnly = true)
    public boolean treatmentRequired(StudentSupportRequest request) {
        return decisionCreditId(request).isPresent();
    }

    @Transactional
    public void approve(
            StudentSupportRequest request,
            Teacher admin,
            LeaveLessonTreatment treatment,
            String reviewNote
    ) {
        requireApprovableLesson(request);
        Optional<UUID> creditId = decisionCreditId(request);
        if (creditId.isPresent() && treatment == null) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Choose whether the prepaid lesson stays charged or becomes a make-up.");
        }
        if (creditId.isEmpty() && treatment != null) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "This leave request has no individual lesson credit to adjust.");
        }

        AbsenceReason absenceReason = absenceReason(request.getLeaveReason());
        String attendanceNote = attendanceNote(request, reviewNote);
        attendanceService.updateAttendance(
                request.getSession().getId(),
                request.getStudent().getId(),
                new UpdateAttendanceRequest(AttendanceStatus.ABSENT, absenceReason, attendanceNote), admin.getId()
        );

        if (creditId.isPresent()) {
            LessonDecision decision = treatment == LeaveLessonTreatment.ALLOW_MAKEUP
                    ? LessonDecision.GRANT_MAKEUP
                    : LessonDecision.COUNT_AS_USED;
            lessonCreditManagementService.decide(
                    admin.getId(),
                    creditId.get(),
                    new LessonDecisionRequest(decision, absenceReason, attendanceNote)
            );
        }
        request.setLeaveLessonTreatment(treatment);
    }

    private void requireApprovableLesson(StudentSupportRequest request) {
        if (request.getSession() == null || request.getStudent() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "This leave request is no longer linked to a lesson.");
        }
        if (request.getSession().getStatus() == SessionStatus.CANCELLED) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "This lesson has been cancelled, so no leave approval is required.");
        }
        attendanceRepository.findBySession_IdAndStudent_Id(
                request.getSession().getId(),
                request.getStudent().getId()
        ).filter(attendance -> attendance.getStatus() == AttendanceStatus.PRESENT
                || attendance.getStatus() == AttendanceStatus.LATE)
                .ifPresent(attendance -> {
                    throw new ResponseStatusException(BAD_REQUEST,
                            "This student is already marked present or late. Correct attendance before approving leave.");
                });
    }

    private Optional<UUID> decisionCreditId(StudentSupportRequest request) {
        if (request.getSession() == null || request.getStudent() == null) return Optional.empty();
        return lessonCreditManagementService.decisionCreditIdForLesson(
                request.getStudent().getId(),
                request.getSession().getId()
        );
    }

    private AbsenceReason absenceReason(LeaveReason reason) {
        return reason == LeaveReason.ILLNESS ? AbsenceReason.ILLNESS : AbsenceReason.ADVANCE_NOTICE;
    }

    private String attendanceNote(StudentSupportRequest request, String reviewNote) {
        String reference = "Approved leave request " + request.getId().toString().substring(0, 8).toUpperCase() + ". ";
        String combined = reference + reviewNote.trim();
        return combined.length() <= ATTENDANCE_NOTE_LIMIT
                ? combined
                : combined.substring(0, ATTENDANCE_NOTE_LIMIT);
    }
}
