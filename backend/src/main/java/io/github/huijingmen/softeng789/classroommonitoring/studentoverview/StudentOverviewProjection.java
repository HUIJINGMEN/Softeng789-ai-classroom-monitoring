package io.github.huijingmen.softeng789.classroommonitoring.studentoverview;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonReconciliationResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ReconciliationSessionResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.StudentPaymentAccountDtos.StudentPaymentAccountRowResponse;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import static io.github.huijingmen.softeng789.classroommonitoring.studentoverview.StudentOverviewDtos.Register;
import static io.github.huijingmen.softeng789.classroommonitoring.studentoverview.StudentOverviewDtos.Summary;

/** Pure register projection: scope-wide totals precede filtering and page slicing. */
final class StudentOverviewProjection {
    private StudentOverviewProjection() { }

    static Register page(List<StudentPaymentAccountRowResponse> candidates,
                         List<LessonReconciliationResponse> registers, boolean singleClass,
                         boolean exceptionsOnly, int page, int size) {
        Map<UUID, List<ReconciliationRowResponse>> rows = registers.stream().flatMap(register -> register.rows().stream())
                .collect(Collectors.groupingBy(ReconciliationRowResponse::studentId));
        Map<UUID, SessionStatus> sessions = registers.stream().flatMap(register -> register.sessions().stream())
                .collect(Collectors.toMap(ReconciliationSessionResponse::id, ReconciliationSessionResponse::status, (left, right) -> left));
        List<StudentPaymentAccountRowResponse> scoped = candidates.stream()
                .filter(account -> !singleClass || rows.containsKey(account.studentId())).toList();
        Summary summary = new Summary(scoped.size(),
                (int) scoped.stream().filter(account -> attention(account, rows, sessions)).count(),
                (int) scoped.stream().filter(StudentOverviewPolicy::paymentIssue).count(),
                StudentOverviewPolicy.missing(rows.values().stream().flatMap(Collection::stream).toList(), sessions));
        List<StudentPaymentAccountRowResponse> visible = scoped.stream()
                .filter(account -> !exceptionsOnly || attention(account, rows, sessions)).toList();
        int totalPages = (int) Math.ceil(visible.size() / (double) size);
        int safePage = Math.min(page, Math.max(0, totalPages - 1));
        int from = safePage * size;
        List<StudentPaymentAccountRowResponse> items = visible.subList(from, Math.min(from + size, visible.size()));
        Set<UUID> ids = items.stream().map(StudentPaymentAccountRowResponse::studentId).collect(Collectors.toSet());
        return new Register(items, registers.stream().map(register -> subset(register, ids)).toList(),
                summary, safePage, size, visible.size(), totalPages);
    }

    private static boolean attention(StudentPaymentAccountRowResponse account, Map<UUID, List<ReconciliationRowResponse>> rows,
                              Map<UUID, SessionStatus> sessions) {
        return StudentOverviewPolicy.needsAttention(account, rows.getOrDefault(account.studentId(), List.of()), sessions);
    }

    private static LessonReconciliationResponse subset(LessonReconciliationResponse source, Set<UUID> ids) {
        List<ReconciliationRowResponse> rows = source.rows().stream().filter(row -> ids.contains(row.studentId())).toList();
        return new LessonReconciliationResponse(source.courseOfferingId(), source.courseCode(), source.academicTerm(),
                source.view(), source.weekStart(), source.weekEnd(), source.sessions(), source.summary(), rows,
                0, rows.size(), rows.size(), rows.isEmpty() ? 0 : 1, false, false);
    }
}
