package io.github.huijingmen.softeng789.classroommonitoring.studentoverview;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentAccountState;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonReconciliationResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationCellResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationSessionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationView;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.StudentPaymentAccountDtos.StudentPaymentAccountRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class StudentOverviewProjectionTest {
    private final LocalDate week = LocalDate.of(2026, 10, 12);

    @Test
    void scopeTotalsRemainIndependentOfPageAndOnlyVisibleStudentsEnterPageRegisters() {
        var first = account(StudentPaymentAccountState.PAID);
        var second = account(StudentPaymentAccountState.OVERDUE);
        UUID session = UUID.randomUUID();
        var register = register(session, List.of(row(first.studentId(), session, AttendanceStatus.UNKNOWN),
                row(second.studentId(), session, AttendanceStatus.PRESENT)));
        var result = StudentOverviewProjection.page(List.of(first, second), List.of(register), false, false, 1, 1);
        assertThat(result.accounts()).containsExactly(second);
        assertThat(result.reconciliations().getFirst().rows()).extracting(ReconciliationRowResponse::studentId)
                .containsExactly(second.studentId());
        assertThat(result.summary()).isEqualTo(new StudentOverviewDtos.Summary(2, 2, 1, 1));
        assertThat(result.totalItems()).isEqualTo(2);
        assertThat(result.totalPages()).isEqualTo(2);
    }

    @Test
    void exceptionFilteringDoesNotShrinkScopeTotalsAndInvalidatedPagesClampSafely() {
        var clean = account(StudentPaymentAccountState.PAID);
        var missing = account(StudentPaymentAccountState.PAID);
        UUID session = UUID.randomUUID();
        var register = register(session, List.of(row(clean.studentId(), session, AttendanceStatus.PRESENT),
                row(missing.studentId(), session, AttendanceStatus.UNKNOWN)));
        var result = StudentOverviewProjection.page(List.of(clean, missing), List.of(register), false, true, 99, 6);
        assertThat(result.accounts()).containsExactly(missing);
        assertThat(result.summary()).isEqualTo(new StudentOverviewDtos.Summary(2, 1, 0, 1));
        assertThat(result.page()).isZero();
        assertThat(result.totalItems()).isEqualTo(1);
    }

    @Test
    void sharedStudentsCountOnceWhileMissingMarksKeepTheirDistinctLessonEvidence() {
        var account = account(StudentPaymentAccountState.PAID);
        UUID firstSession = UUID.randomUUID(), secondSession = UUID.randomUUID();
        var first = register(firstSession, List.of(row(account.studentId(), firstSession, AttendanceStatus.UNKNOWN)));
        var second = register(secondSession, List.of(row(account.studentId(), secondSession, AttendanceStatus.UNKNOWN)));
        var result = StudentOverviewProjection.page(List.of(account), List.of(first, second), false, false, 0, 6);
        assertThat(result.summary()).isEqualTo(new StudentOverviewDtos.Summary(1, 1, 0, 2));
        assertThat(result.accounts()).hasSize(1);
        assertThat(result.reconciliations()).hasSize(2);
    }

    @Test
    void singleClassExcludesAccountsOutsideItsRosterAndEmptyScopesHaveNoInventedPage() {
        var enrolled = account(StudentPaymentAccountState.PAID);
        var unrelated = account(StudentPaymentAccountState.OVERDUE);
        UUID session = UUID.randomUUID();
        var register = register(session, List.of(row(enrolled.studentId(), session, AttendanceStatus.PRESENT)));
        var result = StudentOverviewProjection.page(List.of(enrolled, unrelated), List.of(register), true, false, 0, 6);
        assertThat(result.accounts()).containsExactly(enrolled);
        assertThat(result.summary()).isEqualTo(new StudentOverviewDtos.Summary(1, 0, 0, 0));
        var empty = StudentOverviewProjection.page(List.of(), List.of(), false, true, 99, 6);
        assertThat(empty.summary()).isEqualTo(new StudentOverviewDtos.Summary(0, 0, 0, 0));
        assertThat(empty.totalPages()).isZero();
        assertThat(empty.page()).isZero();
        assertThat(empty.accounts()).isEmpty();
    }

    private StudentPaymentAccountRowResponse account(StudentPaymentAccountState state) {
        return new StudentPaymentAccountRowResponse(UUID.randomUUID(), "Audit student", "S1", List.of("Course"),
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, 0, 0,
                List.of(), null, null, null, state, "NZD");
    }

    private ReconciliationRowResponse row(UUID student, UUID session, AttendanceStatus status) {
        var cell = new ReconciliationCellResponse(session, null, status, null, null,
                null, null, null, null, null, null, null, false);
        return new ReconciliationRowResponse(student, "Audit student", "S1", null, null, null, BigDecimal.ZERO,
                "NZD", null, 0, 0, 0, 0, 0, 0, 0, 0, false, List.of(cell));
    }

    private LessonReconciliationResponse register(UUID sessionId, List<ReconciliationRowResponse> rows) {
        var session = new ReconciliationSessionResponse(sessionId, week, Instant.parse("2026-10-12T01:00:00Z"),
                Instant.parse("2026-10-12T02:00:00Z"), SessionStatus.COMPLETED, "Room", null);
        return new LessonReconciliationResponse(UUID.randomUUID(), "Course", "2026", ReconciliationView.WEEK,
                week, week.plusDays(6), List.of(session), null, rows, 0, rows.size(), rows.size(), 1, false, false);
    }
}
