package io.github.huijingmen.softeng789.classroommonitoring.studentoverview;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonReconciliationResponse;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.StudentPaymentAccountDtos.StudentPaymentAccountRowResponse;
import java.util.List;

public final class StudentOverviewDtos {
    private StudentOverviewDtos() { }

    public record Summary(int totalStudents, int needsAttention, int paymentIssues, int attendanceNotRecorded) { }

    public record StudentRecords(List<StudentPaymentAccountRowResponse> accounts,
                                 List<LessonReconciliationResponse> reconciliations) { }

    public record Register(
            List<StudentPaymentAccountRowResponse> accounts,
            List<LessonReconciliationResponse> reconciliations,
            Summary summary,
            int page, int size, int totalItems, int totalPages
    ) { }
}
