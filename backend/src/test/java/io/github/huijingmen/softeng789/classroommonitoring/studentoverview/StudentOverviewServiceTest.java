package io.github.huijingmen.softeng789.classroommonitoring.studentoverview;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentAccountState;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.StudentPaymentAccountDtos.StudentPaymentAccountRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.LessonReconciliationService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.StudentPaymentAccountService;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.http.HttpStatus.FORBIDDEN;

class StudentOverviewServiceTest {
    private final CourseOfferingRepository offerings = mock(CourseOfferingRepository.class);
    private final StudentPaymentAccountService accounts = mock(StudentPaymentAccountService.class);
    private final LessonReconciliationService reconciliation = mock(LessonReconciliationService.class);
    private final StudentOverviewService service = new StudentOverviewService(offerings, accounts, reconciliation);
    private final UUID classId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();
    private final LocalDate week = LocalDate.parse("2026-10-12");

    @Test
    void paginatesOnceAndKeepsSummaryCountsAcrossAllStudents() {
        CourseOffering offering = offering();
        List<StudentPaymentAccountRowResponse> all = IntStream.range(0, 103).mapToObj(this::account).toList();
        List<ReconciliationRowResponse> rows = all.stream().map(account -> row(account.studentId(), AttendanceStatus.UNKNOWN)).toList();
        when(offerings.findAllByStatusOrderByOfferingCodeAsc("ACTIVE")).thenReturn(List.of(offering));
        when(accounts.accounts("", null)).thenReturn(all);
        when(reconciliation.forStudents(eq(classId), eq(week), eq(ReconciliationView.WEEK), any())).thenReturn(register(rows));
        var result = service.page(null, week, ReconciliationView.COURSE, "", false, 1, 6);
        assertThat(result.accounts()).hasSize(6);
        assertThat(result.accounts().getFirst().studentNumber()).isEqualTo("S6");
        assertThat(result.summary().totalStudents()).isEqualTo(103);
        assertThat(result.summary().needsAttention()).isEqualTo(103);
        assertThat(result.summary().attendanceNotRecorded()).isEqualTo(103);
        assertThat(result.totalPages()).isEqualTo(18);
        assertThat(result.reconciliations().getFirst().rows()).hasSize(6);
        verify(reconciliation, times(1)).forStudents(eq(classId), eq(week), eq(ReconciliationView.WEEK), any());
        verify(accounts, times(1)).accounts("", null);
        verifyNoMoreInteractions(reconciliation, accounts);
    }

    @Test
    void refreshesOnlyTheSelectedStudentAndClass() {
        CourseOffering offering = offering();
        var account = account(1);
        when(offerings.findById(classId)).thenReturn(java.util.Optional.of(offering));
        when(accounts.accounts("", Set.of(account.studentId()))).thenReturn(List.of(account));
        when(reconciliation.forStudents(classId, week, ReconciliationView.WEEK, Set.of(account.studentId())))
                .thenReturn(register(List.of(row(account.studentId(), AttendanceStatus.PRESENT))));
        var result = service.student(classId, account.studentId(), week, ReconciliationView.WEEK);
        assertThat(result.accounts()).containsExactly(account);
        assertThat(result.reconciliations().getFirst().rows()).hasSize(1);
        verify(accounts).accounts("", Set.of(account.studentId()));
        verify(reconciliation).forStudents(classId, week, ReconciliationView.WEEK, Set.of(account.studentId()));
        verifyNoMoreInteractions(accounts, reconciliation);
    }

    @Test
    void courseSearchAndAttentionFilteringPreserveScopeAndClampInvalidatedPages() {
        var account = account(1);
        var offering = offering();
        when(offerings.findAllByStatusOrderByOfferingCodeAsc("ACTIVE")).thenReturn(List.of(offering));
        when(accounts.accounts("", null)).thenReturn(List.of(account));
        when(reconciliation.forStudents(eq(classId), eq(week), eq(ReconciliationView.WEEK), any()))
                .thenReturn(register(List.of(row(account.studentId(), AttendanceStatus.PRESENT))));
        var result = service.page(null, week, ReconciliationView.WEEK, "infosys", true, 99, 6);
        assertThat(result.summary().totalStudents()).isEqualTo(1);
        assertThat(result.summary().needsAttention()).isZero();
        assertThat(result.accounts()).isEmpty();
        assertThat(result.page()).isZero();
    }

    @Test
    void singleClassLoadsOnlyThatClassAccountsRatherThanTheInstitutionDirectory() {
        var offering = offering(); var account = account(1);
        when(offerings.findById(classId)).thenReturn(java.util.Optional.of(offering));
        when(accounts.accountsForClass(classId)).thenReturn(List.of(account));
        when(reconciliation.forStudents(classId, week, ReconciliationView.COURSE, Set.of(account.studentId())))
                .thenReturn(register(List.of(row(account.studentId(), AttendanceStatus.PRESENT))));
        var result = service.page(classId, week, ReconciliationView.COURSE, "", false, 0, 6);
        assertThat(result.accounts()).containsExactly(account);
        verify(accounts).accountsForClass(classId);
        verify(accounts, never()).accounts(anyString(), any());
    }

    @Test
    void invalidPaginationAndUnauthorisedAccessNeverReachDataReads() {
        assertThatThrownBy(() -> service.page(null, week, ReconciliationView.WEEK, "", false, -1, 6))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.page(null, week, ReconciliationView.WEEK, "", false, 0, 101))
                .isInstanceOf(ResponseStatusException.class);
        SessionAuthService auth = mock(SessionAuthService.class);
        when(auth.requireAdmin("student-token")).thenThrow(new ResponseStatusException(FORBIDDEN));
        var controller = new StudentOverviewController(service, auth);
        assertThatThrownBy(() -> controller.page(null, week, ReconciliationView.WEEK, "", false, 0, 6, "student-token"))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> controller.student(UUID.randomUUID(), classId, week, ReconciliationView.WEEK, "student-token"))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(offerings, accounts, reconciliation);
    }

    @Test
    void missingCountsExcludeFutureActiveAndCancelledSessions() {
        var row = row(UUID.randomUUID(), AttendanceStatus.UNKNOWN);
        for (SessionStatus status : List.of(SessionStatus.SCHEDULED, SessionStatus.ACTIVE, SessionStatus.CANCELLED)) {
            assertThat(StudentOverviewPolicy.missing(List.of(row), java.util.Map.of(sessionId, status))).isZero();
        }
    }

    private CourseOffering offering() {
        CourseOffering offering = mock(CourseOffering.class);
        when(offering.getId()).thenReturn(classId); when(offering.getStatus()).thenReturn("ACTIVE"); return offering;
    }

    private StudentPaymentAccountRowResponse account(int index) {
        return new StudentPaymentAccountRowResponse(UUID.randomUUID(), "Student " + index, "S" + index,
                List.of("INFOSYS 222"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                0, 0, 0, 0, List.of(), null, null, null, StudentPaymentAccountState.PAID, "NZD");
    }

    private ReconciliationRowResponse row(UUID studentId, AttendanceStatus attendance) {
        var cell = new ReconciliationCellResponse(sessionId, null, attendance, null, null,
                null, null, null, null, null, null, null, false);
        return new ReconciliationRowResponse(studentId, "Student", "S1", null, null, null, BigDecimal.ZERO,
                "NZD", null, 0, 0, 0, 0, 0, 0, 0, 0, attendance == AttendanceStatus.UNKNOWN, List.of(cell));
    }

    private LessonReconciliationResponse register(List<ReconciliationRowResponse> rows) {
        var session = new ReconciliationSessionResponse(sessionId, week, Instant.parse("2026-10-12T10:00:00Z"),
                Instant.parse("2026-10-12T11:00:00Z"), SessionStatus.COMPLETED, "Room", null);
        return new LessonReconciliationResponse(classId, "INFOSYS 222", "2026", ReconciliationView.WEEK, week, week.plusDays(6),
                List.of(session), null, rows, 0, rows.size(), rows.size(), 1, false, false);
    }
}
