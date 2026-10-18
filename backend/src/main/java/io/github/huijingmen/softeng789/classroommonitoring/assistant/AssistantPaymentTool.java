package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.InvoiceStatusQuery;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import jakarta.persistence.EntityManager;
import java.util.*;
import org.springframework.stereotype.Component;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantText.*;

/** Uses read-only repositories, never directory/account methods that mark overdue or allocate access. */
@Component
class AssistantPaymentTool implements AssistantTool {
    private static final int RESULT_LIMIT = 50;
    private final EntityManager database;
    AssistantPaymentTool(EntityManager database) { this.database = database; }
    public Set<Intent> intents() { return Set.of(Intent.PAYMENTS, Intent.PAYMENT_REVIEW); }
    public ToolResult query(Plan plan, Student student) {
        if (!plan.courseQuery().isBlank() || !plan.dateFrom().equals(java.time.LocalDate.now(ZONE))
                || !plan.dateTo().equals(java.time.LocalDate.now(ZONE))) return new ToolResult(text(plan,
                "第一版付款查询仅支持当前学生账户和当前待核实提交，不支持按课程或历史日期筛选。请询问某学生的当前付款状态。",
                "Payment queries currently support current student invoices and pending submissions, not course or historical-date filters. Ask for a student's current payment status."), List.of(), false);
        if (plan.intent() == Intent.PAYMENT_REVIEW) return pending(plan, student);
        String studentFilter = student == null ? " and (" + InvoiceStatusQuery.CURRENT_STATUS + ") in :open" : " and invoice.student.id = :student";
        var query = database.createQuery("select invoice from StudentInvoice invoice join fetch invoice.student where invoice.status not in :hidden" + studentFilter
                + " order by invoice.dueDate, invoice.createdAt, invoice.id", StudentInvoice.class)
                .setParameter("hidden", Set.of(InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED));
        if (student == null) query.setParameter("open", Set.of(InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE))
                .setParameter("today", java.time.LocalDate.now(ZONE));
        else query.setParameter("student", student.getId());
        var invoices = query.setMaxResults(RESULT_LIMIT + 1).getResultList();
        var visibleInvoices = invoices.stream().limit(RESULT_LIMIT).toList();
        boolean truncated = invoices.size() > RESULT_LIMIT;
        var rows = visibleInvoices.stream().map(invoice -> new AnswerRow(invoice.getId().toString(), invoice.getStudent().getFullName(),
                invoice.getStudent().getStudentNumber() + " · " + invoice.getInvoiceNumber(), AssistantPaymentSummary.status(invoice),
                List.of(fact(plan, "已确认净收款", "Confirmed net receipts", invoice.getCurrency() + " " + InvoiceAmounts.payments(invoice)),
                        fact(plan, "余额", "Outstanding", invoice.getCurrency() + " " + InvoiceAmounts.balance(invoice)),
                        fact(plan, "到期日期", "Due", invoice.getDueDate())), new Source(SourceType.PAYMENTS, invoice.getStudent().getId()))).toList();
        String message = AssistantPaymentSummary.describe(plan, student, visibleInvoices, truncated);
        return new ToolResult(message, rows, truncated);
    }
    private ToolResult pending(Plan plan, Student student) {
        String filter = student == null ? "" : " and i.student.id = :student";
        var query = database.createQuery("select p from ManualPaymentSubmission p join fetch p.invoice i join fetch i.student where p.status = :status and i.status not in :hidden"
                + filter + " order by p.submittedAt, p.id", ManualPaymentSubmission.class)
                .setParameter("status", ManualPaymentStatus.PENDING).setParameter("hidden", Set.of(InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED));
        if (student != null) query.setParameter("student", student.getId());
        var submissions = query.setMaxResults(RESULT_LIMIT + 1).getResultList();
        var rows = submissions.stream().limit(RESULT_LIMIT).map(item -> new AnswerRow(item.getId().toString(), item.getInvoice().getStudent().getFullName(),
                item.getInvoice().getInvoiceNumber(), "AWAITING_VERIFICATION", List.of(
                fact(plan, "提交金额（未确认）", "Submitted, unconfirmed", item.getInvoice().getCurrency() + " " + item.getAmount()),
                fact(plan, "提交日期", "Submitted", item.getSubmittedAt().atZone(ZONE).toLocalDate())),
                new Source(SourceType.PAYMENTS, item.getInvoice().getStudent().getId()))).toList();
        return new ToolResult(text(plan, submissions.isEmpty() ? "目前没有待核实的付款提交。" : "以下付款提交等待核实，尚不能视为已收到款项；本助手不会批准或拒绝它们。",
                submissions.isEmpty() ? "No payment submissions are awaiting verification." : "These submissions await verification and are not confirmed receipts. This assistant cannot approve or reject them."),
                rows, submissions.size() > RESULT_LIMIT);
    }
}
