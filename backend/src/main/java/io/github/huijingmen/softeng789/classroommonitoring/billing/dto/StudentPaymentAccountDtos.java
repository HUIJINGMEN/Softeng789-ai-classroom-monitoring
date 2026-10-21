package io.github.huijingmen.softeng789.classroommonitoring.billing.dto;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentAccountState;
import io.github.huijingmen.softeng789.classroommonitoring.dto.PageResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class StudentPaymentAccountDtos {
    private StudentPaymentAccountDtos() {
    }

    public record StudentPaymentAccountRowResponse(
            UUID studentId,
            String studentName,
            String studentNumber,
            List<String> courses,
            BigDecimal issued,
            BigDecimal received,
            BigDecimal balance,
            BigDecimal overdueBalance,
            BigDecimal paymentReported,
            long invoiceCount,
            long draftCount,
            long pendingEvidenceCount,
            int unbilledCourseCount,
            List<String> unbilledCourses,
            LocalDate nextDueDate,
            UUID primaryInvoiceId,
            String primaryInvoiceTitle,
            StudentPaymentAccountState state,
            String currency
    ) {
    }

    public record StudentPaymentDirectorySummaryResponse(
            long studentCount,
            long needsActionCount,
            long awaitingPaymentCount,
            long paidCount,
            long clearCount,
            BigDecimal outstanding,
            BigDecimal paymentReported,
            String currency
    ) {
    }

    public record StudentPaymentDirectoryResponse(
            StudentPaymentDirectorySummaryResponse summary,
            PageResponse<StudentPaymentAccountRowResponse> page
    ) {
    }
}
