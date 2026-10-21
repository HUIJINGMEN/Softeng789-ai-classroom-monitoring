package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantText.ZONE;
import static org.assertj.core.api.Assertions.assertThat;

class AssistantPaymentSummaryTest {
    private final LocalDate today = LocalDate.now(ZONE);
    private Plan plan() { return new Plan(Intent.PAYMENTS,"","",today,today,false,"en","QWEN:test"); }
    private StudentInvoice invoice(String currency, String charge, String paid, int dueOffset) {
        var invoice = new StudentInvoice(); invoice.setCurrency(currency); invoice.setDueDate(today.plusDays(dueOffset));
        var item = new InvoiceLineItem(); item.setType(LineItemType.CHARGE); item.setAmount(new BigDecimal(charge)); invoice.addLineItem(item);
        var transaction = new PaymentTransaction(); transaction.setStatus(PaymentStatus.SUCCEEDED); transaction.setAmount(new BigDecimal(paid)); invoice.addTransaction(transaction);
        return invoice;
    }
    @Test void currenciesStaySeparateAndOnlyUnpaidPastDueInvoicesCount() {
        var summary = AssistantPaymentSummary.describe(plan(),null,List.of(invoice("NZD","100","20",-1),invoice("USD","100","30",2),invoice("NZD","50","50",-2)),false);
        assertThat(summary).contains("3 issued invoices","NZD 80.00; USD 70.00","1 have an unpaid balance past the due date").doesNotContain("150.00");
    }
    @Test void refundedFundsIncreaseTheBalanceAndFailedTransactionsAreExcluded() {
        var invoice = invoice("NZD","100","20",-1);
        var refund = new PaymentTransaction(); refund.setStatus(PaymentStatus.REFUNDED); refund.setAmount(new BigDecimal("10")); invoice.addTransaction(refund);
        var failed = new PaymentTransaction(); failed.setStatus(PaymentStatus.FAILED); failed.setAmount(new BigDecimal("90")); invoice.addTransaction(failed);
        assertThat(AssistantPaymentSummary.describe(plan(),null,List.of(invoice),false)).contains("NZD 90.00");
    }
    @Test void limitedResultsNeverClaimToBeAFullAccountBalance() {
        var invoices = IntStream.range(0,50).mapToObj(index -> invoice("NZD","100","20",1)).toList();
        assertThat(AssistantPaymentSummary.describe(plan(),null,invoices,true)).contains("NZD 4000.00","only the first 50 returned invoices, not the full account");
    }
    @Test void noInvoicesCannotBeReportedAsSettled() {
        assertThat(AssistantPaymentSummary.describe(plan(),null,List.of(),false)).contains("does not prove that the account is settled");
    }
    @Test void staleStoredStatusesAreFlaggedWithoutChangingTheInvoice() {
        var invoice = invoice("NZD","100","100",-1); invoice.setStatus(InvoiceStatus.PARTIALLY_PAID);
        assertThat(AssistantPaymentSummary.status(invoice)).isEqualTo("PAID");
        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.PARTIALLY_PAID);
        assertThat(AssistantPaymentSummary.describe(plan(),null,List.of(invoice),false)).contains("do not match their ledger balances");
        invoice.setStatus(InvoiceStatus.PAID); assertThat(AssistantPaymentSummary.status(invoice)).isEqualTo("PAID");
        var unpaid = invoice("NZD","100","20",-1); unpaid.setStatus(InvoiceStatus.PENDING);
        assertThat(AssistantPaymentSummary.status(unpaid)).isEqualTo("OVERDUE"); assertThat(unpaid.getStatus()).isEqualTo(InvoiceStatus.PENDING);
    }
}
