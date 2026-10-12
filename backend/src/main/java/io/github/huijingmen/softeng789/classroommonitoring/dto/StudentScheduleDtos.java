package io.github.huijingmen.softeng789.classroommonitoring.dto;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonMakeupRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.LeaveReason;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class StudentScheduleDtos {
    private StudentScheduleDtos() {
    }

    public enum CoverageStatus {
        COVERED,
        USED,
        COUNTED_ABSENCE,
        MAKEUP_DUE,
        MAKEUP_SCHEDULED,
        UNPAID_ATTENDANCE,
        UNCOVERED,
        NOT_REQUIRED
    }

    public record StudentScheduleSummaryResponse(
            int plannedSessions,
            int upcomingSessions,
            int coveredUpcomingSessions,
            int uncoveredUpcomingSessions,
            int purchasedLessons,
            int activeLessons,
            int usedLessons,
            int remainingLessons,
            int pendingPaymentLessons,
            int makeupDue,
            int expiringLessons,
            LocalDate nextExpiryDate
    ) {
    }

    public record StudentScheduleSessionResponse(
            UUID id,
            UUID courseOfferingId,
            String courseCode,
            String courseName,
            String offeringCode,
            String academicTerm,
            LocalDate date,
            Instant startTime,
            Instant endTime,
            SessionStatus status,
            String room,
            String campus,
            String teacher,
            AttendanceStatus attendanceStatus,
            UUID lessonCreditId,
            LessonCreditStatus lessonCreditStatus,
            CoverageStatus coverageStatus,
            UUID relatedSessionId,
            LocalDate relatedSessionDate,
            LocalDate creditExpiresOn,
            UUID makeupRequestId,
            LessonMakeupRequestStatus makeupRequestStatus,
            LocalDate makeupRequestedSessionDate,
            UUID leaveRequestId,
            StudentRequestStatus leaveRequestStatus,
            LeaveReason leaveReason
    ) {
    }

    public record StudentScheduleResponse(
            UUID studentId,
            StudentScheduleSummaryResponse summary,
            List<StudentScheduleSessionResponse> sessions
    ) {
    }
}
