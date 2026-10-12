package io.github.huijingmen.softeng789.classroommonitoring.billing.dto;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AbsenceReason;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditEventType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class LessonReconciliationDtos {
    private LessonReconciliationDtos() {
    }

    public enum LessonDecision {
        COUNT_AS_USED,
        GRANT_MAKEUP
    }

    public enum ReconciliationView {
        WEEK,
        COURSE
    }

    public record LessonDecisionRequest(
            @NotNull LessonDecision decision,
            @NotNull AbsenceReason reason,
            @NotBlank @Size(max = 500) String note
    ) {
    }

    public record ScheduleMakeupRequest(@NotNull UUID targetSessionId) {
    }

    public record ReconciliationSessionResponse(
            UUID id,
            LocalDate date,
            Instant startTime,
            Instant endTime,
            SessionStatus status,
            String room,
            String campus
    ) {
    }

    public record ReconciliationCellResponse(
            UUID sessionId,
            UUID attendanceRecordId,
            AttendanceStatus attendanceStatus,
            UUID lessonCreditId,
            LessonCreditStatus creditStatus,
            AbsenceReason absenceReason,
            String absenceNote,
            String decisionNote,
            UUID originalSessionId,
            LocalDate originalSessionDate,
            UUID makeupSessionId,
            LocalDate makeupSessionDate,
            boolean uncoveredAttendance
    ) {
    }

    public record ReconciliationRowResponse(
            UUID studentId,
            String studentName,
            String studentNumber,
            UUID packageId,
            UUID invoiceId,
            InvoiceStatus paymentStatus,
            BigDecimal balance,
            String currency,
            CoursePurchaseMode purchaseMode,
            int purchasedSessions,
            int activeSessions,
            int pendingSessions,
            int usedSessions,
            int remainingSessions,
            int makeupDue,
            int expiringSessions,
            int uncoveredAttendance,
            boolean needsAttention,
            List<ReconciliationCellResponse> cells
    ) {
    }

    public record ReconciliationSummaryResponse(
            int totalStudents,
            int fullyReconciled,
            int paymentIssues,
            int makeupDue,
            int expiringCredits,
            int attendanceNotRecorded,
            int uncoveredAttendance
    ) {
    }

    public record LessonReconciliationResponse(
            UUID courseOfferingId,
            String courseCode,
            String academicTerm,
            ReconciliationView view,
            LocalDate weekStart,
            LocalDate weekEnd,
            List<ReconciliationSessionResponse> sessions,
            ReconciliationSummaryResponse summary,
            List<ReconciliationRowResponse> rows,
            int page,
            int size,
            long totalItems,
            int totalPages,
            boolean hasPrevious,
            boolean hasNext
    ) {
    }

    public record MakeupOptionResponse(
            UUID sessionId,
            LocalDate date,
            Instant startTime,
            Instant endTime,
            String room,
            String campus,
            int capacity,
            long reservedSeats
    ) {
    }

    public record LessonCreditEventResponse(
            UUID id,
            LessonCreditEventType eventType,
            LessonCreditStatus fromStatus,
            LessonCreditStatus toStatus,
            UUID sourceSessionId,
            LocalDate sourceSessionDate,
            UUID targetSessionId,
            LocalDate targetSessionDate,
            String note,
            String actorName,
            Instant createdAt
    ) {
    }

    public record LessonCreditDetailResponse(
            UUID id,
            LessonCreditStatus status,
            AbsenceReason absenceReason,
            String decisionNote,
            UUID originalSessionId,
            LocalDate originalSessionDate,
            UUID currentSessionId,
            LocalDate currentSessionDate,
            List<LessonCreditEventResponse> events
    ) {
    }
}
