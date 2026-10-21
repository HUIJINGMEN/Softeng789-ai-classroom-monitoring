package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceAmounts;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.InvoiceStatusPolicy;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.TreeMap;
import java.util.stream.Collectors;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.Plan;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantText.*;

/** Factual, currency-separated summaries of exactly the bounded invoices returned by the tool. */
final class AssistantPaymentSummary {
    private AssistantPaymentSummary() { }

    static String status(StudentInvoice invoice) {
        return InvoiceStatusPolicy.current(invoice).name();
    }

    static String describe(Plan plan, Student student, List<StudentInvoice> invoices, boolean limited) {
        if (invoices.isEmpty()) return text(plan,
                "没有找到符合范围的已签发账单；这不能证明账户已结清或无需缴费。",
                "No issued invoices match this scope. This does not prove that the account is settled or no fees are due.");
        var balances = new TreeMap<String, BigDecimal>();
        int pastDue = 0;
        for (var invoice : invoices) {
            var balance = InvoiceAmounts.balance(invoice);
            balances.merge(invoice.getCurrency(), balance, BigDecimal::add);
            if (balance.signum() > 0 && invoice.getDueDate().isBefore(LocalDate.now(ZONE))) pastDue++;
        }
        String amounts = balances.entrySet().stream()
                .map(entry -> entry.getKey() + " " + entry.getValue().toPlainString())
                .collect(Collectors.joining("; "));
        String scope = student == null ? text(plan, "所查范围", "This scope") : student.getFullName();
        String message = text(plan,
                scope + "：" + invoices.size() + " 张已签发账单，未付余额 " + amounts + "。其中 " + pastDue + " 张仍有余额且已过到期日。",
                scope + ": " + invoices.size() + " issued invoices; outstanding " + amounts + ". " + pastDue + " have an unpaid balance past the due date.");
        String limit = limited ? text(plan, "仅汇总返回的前 50 张账单，并非完整账户余额。", "Totals cover only the first 50 returned invoices, not the full account.") : "";
        long mismatches = invoices.stream().filter(invoice -> (invoice.getStatus() == InvoiceStatus.PAID)
                != (InvoiceAmounts.balance(invoice).signum() == 0)).count();
        String review = mismatches == 0 ? "" : text(plan,
                "\n" + mismatches + " 张账单的保存状态与账目余额不一致，请打开付款账户核对；助手没有修改状态。",
                "\n" + mismatches + " saved invoice statuses do not match their ledger balances. Open the payment account to check; no status was changed.");
        return message + review + "\n" + limit + text(plan,
                "这是当前账单快照，不是期间收款统计。待核实提交不算到账；草稿与已取消账单不计入，不同币种分开汇总。",
                "Current invoice snapshot, not period receipts. Unverified submissions are not received funds. Draft/cancelled invoices are excluded; currencies are kept separate.");
    }
}
