package io.github.huijingmen.softeng789.classroommonitoring.studentoverview;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentAccountState;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.StudentPaymentAccountDtos.StudentPaymentAccountRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** Register-specific rules, separate from invoice state and reconciliation decisions. */
final class StudentOverviewPolicy {
    private StudentOverviewPolicy() { }

    static boolean matches(StudentPaymentAccountRowResponse account, String query) {
        String search = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return account.studentName().toLowerCase(Locale.ROOT).contains(search)
                || account.studentNumber().toLowerCase(Locale.ROOT).contains(search)
                || account.courses().stream().anyMatch(course -> course.toLowerCase(Locale.ROOT).contains(search));
    }

    static boolean paymentIssue(StudentPaymentAccountRowResponse account) {
        return account.state() != StudentPaymentAccountState.PAID
                && account.state() != StudentPaymentAccountState.NO_PAYMENT_DUE;
    }

    static int missing(List<ReconciliationRowResponse> rows, Map<UUID, SessionStatus> sessions) {
        return (int) rows.stream().flatMap(row -> row.cells().stream())
                .filter(cell -> cell.attendanceStatus() == AttendanceStatus.UNKNOWN)
                .filter(cell -> sessions.get(cell.sessionId()) == SessionStatus.COMPLETED).count();
    }

    static boolean needsAttention(StudentPaymentAccountRowResponse account,
                                  List<ReconciliationRowResponse> rows, Map<UUID, SessionStatus> sessions) {
        return paymentIssue(account) || rows.stream().flatMap(row -> row.cells().stream()).anyMatch(cell -> {
            SessionStatus status = sessions.get(cell.sessionId());
            if (status == SessionStatus.CANCELLED) return cell.creditStatus() == LessonCreditStatus.MAKEUP_DUE;
            if (status == SessionStatus.ACTIVE && cell.attendanceStatus() == AttendanceStatus.UNKNOWN) return false;
            if (status == SessionStatus.SCHEDULED && cell.attendanceStatus() == AttendanceStatus.UNKNOWN) {
                return cell.uncoveredAttendance() || cell.creditStatus() == null
                        || cell.creditStatus() == LessonCreditStatus.PENDING_PAYMENT;
            }
            return cell.attendanceStatus() == AttendanceStatus.UNKNOWN || cell.uncoveredAttendance()
                    || cell.creditStatus() == LessonCreditStatus.PENDING_PAYMENT || cell.creditStatus() == LessonCreditStatus.MAKEUP_DUE;
        });
    }
}
