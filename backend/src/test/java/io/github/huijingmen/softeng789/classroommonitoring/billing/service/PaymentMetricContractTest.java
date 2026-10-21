package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import static io.github.huijingmen.softeng789.classroommonitoring.auth.BrowserTestSession.browserSession;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real repository queries and HTTP contracts, isolated in H2; no live payments or project DB access. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:payment-metric-contract;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
        "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
@AutoConfigureMockMvc
@Transactional
class PaymentMetricContractTest {
    @Autowired StudentRepository students;
    @Autowired TeacherRepository teachers;
    @Autowired StudentInvoiceRepository invoices;
    @Autowired StudentPaymentAccountService accounts;
    @Autowired AdminPaymentQueryService queries;
    @Autowired BillingOperationsService operations;
    @Autowired SessionAuthService auth;
    @Autowired MockMvc mvc;
    private Student student;
    private Teacher admin;
    private LocalDate today;

    @BeforeEach
    void fixture() {
        today = BillingDates.today();
        admin = new Teacher(); admin.setStaffNumber("METRIC-ADMIN"); admin.setName("Metric admin");
        admin.setEmail("metric-admin@example.test"); admin.setRole("ADMIN"); teachers.save(admin);
        student = new Student(); student.setStudentNumber("METRIC-A"); student.setFirstName("Metric"); student.setLastName("Student");
        student.setUniversityEmail("metric-a@example.test"); student.setCourse("Test"); student.setProgramme("Test"); student.setSeat("A1"); students.save(student);
    }

    @Test
    void mixedDueDatesAgreeAcrossRepositoryDirectoryHttpAndOperations() throws Exception {
        invoice("85", "0", -13);
        invoice("500", "0", 12);
        invoice("500", "500", -20);
        var row = accounts.directory("METRIC-A", null, 0, 20).page().items().getFirst();
        assertThat(row.balance()).isEqualByComparingTo("585");
        assertThat(row.overdueBalance()).isEqualByComparingTo("85");
        var financial = operations.dashboard(today.withDayOfYear(1), today).financial();
        assertThat(financial.outstanding()).isEqualByComparingTo(row.balance());
        assertThat(financial.overdue()).isEqualByComparingTo(row.overdueBalance());
        String token = "Bearer " + auth.issueToken("ADMIN", admin.getId(), admin.getName(), admin.getEmail(), null).token();
        mvc.perform(get("/api/admin/payment-accounts").param("query", "METRIC-A").with(browserSession(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.page.items[0].balance").value(585.0))
                .andExpect(jsonPath("$.page.items[0].overdueBalance").value(85.0));
        mvc.perform(get("/api/admin/payments").with(browserSession(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary.issued").value(1085.0))
                .andExpect(jsonPath("$.summary.collected").value(500.0));
    }

    @Test
    void multipleOverdueInvoicesForOneStudentRemainTwoInvoicesAndOneAccount() {
        invoice("85", "0", -13); invoice("9", "0", -1);
        var directory = accounts.directory("METRIC-A", null, 0, 20);
        assertThat(directory.summary().studentCount()).isEqualTo(1);
        assertThat(directory.summary().needsActionCount()).isEqualTo(1);
        assertThat(directory.page().items().getFirst().overdueBalance()).isEqualByComparingTo("94");
        assertThat(queries.list("", null, 0, 20).summary().overdueCount()).isEqualTo(2);
    }

    @Test
    void overpaymentNeverInflatesIssuedFeesOrPaysAnotherInvoice() {
        invoice("50", "100", -1); invoice("100", "0", 12);
        var summary = queries.list("", null, 0, 20).summary();
        assertThat(summary.issued()).isEqualByComparingTo("150");
        assertThat(summary.collectionRate()).isEqualTo(33);
        assertThat(summary.collected()).isEqualByComparingTo("100");
        assertThat(summary.outstanding()).isEqualByComparingTo("100");
        var row = accounts.directory("METRIC-A", null, 0, 20).page().items().getFirst();
        assertThat(row.balance()).isEqualByComparingTo(summary.outstanding());
        assertThat(row.overdueBalance()).isZero();
    }

    @Test
    void multipleLinesAndReceiptsDoNotMultiplyEachOtherDuringAggregation() {
        var invoice = invoice("100", "80", -1);
        addLine(invoice, LineItemType.CHARGE, "20"); addLine(invoice, LineItemType.CREDIT, "10");
        addReceipt(invoice, PaymentStatus.REFUNDED, "20"); addReceipt(invoice, PaymentStatus.FAILED, "999");
        invoices.saveAndFlush(invoice);
        var summary = queries.list("", null, 0, 20).summary();
        assertThat(summary.issued()).isEqualByComparingTo("110");
        assertThat(summary.collected()).isEqualByComparingTo("60");
        assertThat(summary.outstanding()).isEqualByComparingTo("50");
        var row = accounts.directory("METRIC-A", null, 0, 20).page().items().getFirst();
        assertThat(row.issued()).isEqualByComparingTo(summary.issued());
        assertThat(row.received()).isEqualByComparingTo(summary.collected());
        assertThat(row.overdueBalance()).isEqualByComparingTo("50");
        var financial = operations.dashboard(today.withDayOfYear(1), today).financial();
        assertThat(financial.netReceived()).isEqualByComparingTo("60");
        assertThat(financial.overdue()).isEqualByComparingTo("50");
    }

    private StudentInvoice invoice(String charge, String paid, int dueOffset) {
        var invoice = new StudentInvoice(); invoice.setStudent(student); invoice.setCreatedByAdmin(admin);
        invoice.setInvoiceNumber("METRIC-" + UUID.randomUUID().toString().substring(0, 16));
        invoice.setTitle("Metric contract"); invoice.setDueDate(today.plusDays(dueOffset)); invoice.setStatus(InvoiceStatus.PENDING);
        addLine(invoice, LineItemType.CHARGE, charge);
        if (new BigDecimal(paid).signum() > 0) addReceipt(invoice, PaymentStatus.SUCCEEDED, paid);
        return invoices.saveAndFlush(invoice);
    }

    private void addLine(StudentInvoice invoice, LineItemType type, String amount) {
        var item = new InvoiceLineItem(); item.setDescription("Metric fixture"); item.setType(type);
        item.setAmount(new BigDecimal(amount)); invoice.addLineItem(item);
    }

    private void addReceipt(StudentInvoice invoice, PaymentStatus status, String amount) {
        var receipt = new PaymentTransaction(); receipt.setStatus(status); receipt.setAmount(new BigDecimal(amount));
        receipt.setProvider("TEST"); receipt.setProviderReference("metric-" + UUID.randomUUID());
        receipt.setOccurredAt(Instant.now().minusSeconds(60)); invoice.addTransaction(receipt);
    }
}
