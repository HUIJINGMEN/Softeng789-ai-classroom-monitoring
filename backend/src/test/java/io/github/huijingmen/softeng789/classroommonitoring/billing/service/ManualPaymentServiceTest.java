package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import static io.github.huijingmen.softeng789.classroommonitoring.auth.BrowserTestSession.browserSession;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentMethod;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceLineItem;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentInvoice;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentSubmission;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoiceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LineItemRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.ReviewManualPaymentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.UpdateBankAccountRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.ManualPaymentSubmissionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.PaymentBankAccountRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:manual-payment-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.storage.payment-evidence-dir=target/test-payment-evidence"
})
@ActiveProfiles("postgres")
@AutoConfigureMockMvc
class ManualPaymentServiceTest {
    @Autowired private MockMvc mvc;
    @Autowired private SessionAuthService auth;
    @Autowired private ManualPaymentService manualPaymentService;
    @Autowired private PaymentEvidenceStorage receiptStorage;
    @Autowired private PaymentService paymentService;
    @Autowired private InvoicePublicationService invoicePublicationService;
    @Autowired private ManualPaymentSubmissionRepository transferRepository;
    @Autowired private PaymentBankAccountRepository accountRepository;
    @Autowired private StudentInvoiceRepository invoiceRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private TeacherRepository teacherRepository;
    @Autowired private JdbcTemplate jdbc;

    private Teacher admin;
    private Student student;

    @Test
    void manualOnlyStatementAndDirectCheckoutAgreeAndCannotCreateLedgerEntries() throws Exception {
        var invoice = createInvoice();
        String token = "Bearer " + auth.issueToken("STUDENT", student.getId(), student.getFullName(),
                student.getUniversityEmail(), "APPROVED").token();
        mvc.perform(get("/api/students/" + student.getId() + "/payments").with(browserSession(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.demoMode").value(false))
                .andExpect(jsonPath("$.paymentMethods.length()").value(2))
                .andExpect(jsonPath("$.paymentMethods[0]").value("BANK_TRANSFER"))
                .andExpect(jsonPath("$.paymentMethods[1]").value("CASH"));
        mvc.perform(post("/api/students/" + student.getId() + "/payments/" + invoice.id() + "/checkout")
                .with(browserSession(token))).andExpect(status().isForbidden());
        var unchanged = paymentService.statement(student.getId());
        assertThat(unchanged.totalPayments()).isEqualByComparingTo("0.00");
        assertThat(unchanged.amountDue()).isEqualByComparingTo("180.00");
        assertThat(unchanged.invoices().getFirst().transactions()).isEmpty();
        assertThat(transferRepository.count()).isZero();
    }

    @BeforeEach
    void cleanDatabase() {
        transferRepository.findAll().forEach(transfer -> receiptStorage.delete(transfer.getId()));
        transferRepository.deleteAll();
        accountRepository.deleteAll();
        invoiceRepository.deleteAll();
        studentRepository.deleteAll();
        teacherRepository.deleteAll();
        admin = admin();
        student = student();
        manualPaymentService.updateBankAccount(admin.getId(), new UpdateBankAccountRequest(
                "ClassLens Student Fees",
                "Demo Bank",
                "12-3456-0789012-00",
                "Use your student number",
                "Allow one business day for review."
        ));
    }

    @Test
    void approvedReceiptRecordsAnAuditablePayment() {
        var invoice = createInvoice();
        var submission = manualPaymentService.submit(
                student.getId(), invoice.id(), ManualPaymentMethod.BANK_TRANSFER, new BigDecimal("80.00"), "Transferred today.", receipt()
        );

        assertThat(paymentService.statement(student.getId()).amountDue()).isEqualByComparingTo("180.00");
        assertThat(submission.status()).isEqualTo(ManualPaymentStatus.PENDING);
        assertThat(submission.invoiceNumber()).isEqualTo(invoice.invoiceNumber());
        assertThat(submission.invoiceTitle()).isEqualTo("Semester fees");
        assertThat(submission.invoiceBalance()).isEqualByComparingTo("180.00");

        manualPaymentService.review(
                admin.getId(), submission.id(), new ReviewManualPaymentRequest(ManualPaymentStatus.APPROVED, "Matched", java.time.LocalDate.of(2026, 10, 1))
        );

        var statement = paymentService.statement(student.getId());
        assertThat(statement.totalPayments()).isEqualByComparingTo("80.00");
        assertThat(statement.amountDue()).isEqualByComparingTo("100.00");
        assertThat(statement.invoices().getFirst().status()).isEqualTo(InvoiceStatus.PARTIALLY_PAID);
        assertThat(statement.invoices().getFirst().transactions()).singleElement().satisfies(transaction -> {
            assertThat(transaction.occurredAt()).isEqualTo(java.time.LocalDate.of(2026, 10, 1)
                    .atStartOfDay(io.github.huijingmen.softeng789.classroommonitoring.service.SessionClock.AUCKLAND).toInstant());
            assertThat(transaction.provider()).isEqualTo("BANK_TRANSFER");
            assertThat(transaction.amount()).isEqualByComparingTo("80.00");
        });
    }

    @Test
    void amountPrecisionIsRejectedBeforeAnySubmissionOrEvidenceIsStored() {
        var invoice = createInvoice();
        for (var amount : java.util.Arrays.asList(null, new BigDecimal("1.234"), new BigDecimal("1.230"),
                BigDecimal.ZERO, new BigDecimal("-1"), new BigDecimal("10000000000"))) {
            assertThatThrownBy(() -> manualPaymentService.submit(student.getId(), invoice.id(), ManualPaymentMethod.CASH,
                    amount, null, null)).isInstanceOf(ResponseStatusException.class);
        }
        assertThat(transferRepository.count()).isZero();
        assertThat(paymentService.statement(student.getId()).totalPayments()).isEqualByComparingTo("0");
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-10-01T01:02:03.123456Z", "2026-10-01T01:02:03.123456789Z"})
    void approvalRequiresAnActualReceiptDateButDoesNotInferOrOverwriteHistoricalDates(String originalTime) {
        var invoice = createInvoice();
        var submitted = manualPaymentService.submit(student.getId(), invoice.id(), ManualPaymentMethod.CASH,
                new BigDecimal("50"), null, null);
        assertThat(submitted.receivedDate()).isNull();
        // Exercise both clock precisions deterministically, including on platforms whose clock
        // already returns microseconds. Compare database round trips, not a pre-flush DTO's nanos.
        jdbc.update("UPDATE manual_payment_submissions SET submitted_at = ? WHERE id = ?",
                java.sql.Timestamp.from(java.time.Instant.parse(originalTime)), submitted.id());
        var persistedSubmittedAt = transferRepository.findById(submitted.id()).orElseThrow().getSubmittedAt();
        for (var date : java.util.Arrays.asList(null, java.time.LocalDate.now(
                io.github.huijingmen.softeng789.classroommonitoring.service.SessionClock.AUCKLAND).plusDays(1))) {
            assertThatThrownBy(() -> manualPaymentService.review(admin.getId(), submitted.id(),
                    new ReviewManualPaymentRequest(ManualPaymentStatus.APPROVED, null, date)))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("actual receipt date");
        }
        assertThat(transferRepository.findById(submitted.id()).orElseThrow().getStatus()).isEqualTo(ManualPaymentStatus.PENDING);
        assertThat(transferRepository.findById(submitted.id()).orElseThrow().getSubmittedAt()).isEqualTo(persistedSubmittedAt);
        var approved = manualPaymentService.review(admin.getId(), submitted.id(), new ReviewManualPaymentRequest(
                ManualPaymentStatus.APPROVED, null, java.time.LocalDate.of(2026, 10, 1)));
        assertThat(approved.receivedDate()).isEqualTo(java.time.LocalDate.of(2026, 10, 1));
        assertThat(approved.submittedAt()).isEqualTo(persistedSubmittedAt);
        assertThat(transferRepository.findById(submitted.id()).orElseThrow().getSubmittedAt()).isEqualTo(persistedSubmittedAt);
    }

    @Test
    void approvedCashReceiptRecordsCashWithoutBankDetails() {
        accountRepository.deleteAll();
        var invoice = createInvoice();
        var submission = manualPaymentService.submit(
                student.getId(), invoice.id(), ManualPaymentMethod.CASH, new BigDecimal("50.00"), "Paid at reception.", receipt()
        );

        assertThat(paymentService.statement(student.getId()).amountDue()).isEqualByComparingTo("180.00");

        manualPaymentService.review(
                admin.getId(), submission.id(), new ReviewManualPaymentRequest(ManualPaymentStatus.APPROVED, "Receipt verified", java.time.LocalDate.of(2026, 10, 1))
        );

        var statement = paymentService.statement(student.getId());
        assertThat(statement.amountDue()).isEqualByComparingTo("130.00");
        assertThat(statement.invoices().getFirst().transactions()).singleElement().satisfies(transaction -> {
            assertThat(transaction.provider()).isEqualTo("CASH");
            assertThat(transaction.amount()).isEqualByComparingTo("50.00");
        });
    }

    @Test
    void cashWithoutAttachmentStaysPendingUntilAdminApprovalAndRetainsAnAuditTrail() {
        accountRepository.deleteAll();
        var invoice = createInvoice();
        var submission = manualPaymentService.submit(student.getId(), invoice.id(), ManualPaymentMethod.CASH,
                new BigDecimal("50.00"), "Paid at reception.", null);
        assertThat(submission.receiptFileName()).isNull();
        assertThat(submission.receiptContentType()).isNull();
        assertThat(submission.receiptFileSize()).isZero();
        assertThat(submission.status()).isEqualTo(ManualPaymentStatus.PENDING);
        assertThat(paymentService.statement(student.getId()).totalPayments()).isEqualByComparingTo("0.00");
        assertThatThrownBy(() -> manualPaymentService.receiptForAdmin(submission.id()))
                .hasMessageContaining("No receipt was attached");

        var approved = manualPaymentService.review(admin.getId(), submission.id(),
                new ReviewManualPaymentRequest(ManualPaymentStatus.APPROVED, "Verified against reception cash record", java.time.LocalDate.of(2026, 10, 1)));
        assertThat(approved.status()).isEqualTo(ManualPaymentStatus.APPROVED);
        assertThat(approved.reviewedAt()).isNotNull();
        assertThat(approved.reviewNote()).isEqualTo("Verified against reception cash record");
        assertThat(approved.invoiceBalance()).isEqualByComparingTo("130.00");
        var saved = transferRepository.findById(submission.id()).orElseThrow();
        assertThat(saved.getReviewedByAdmin().getId()).isEqualTo(admin.getId());
        assertThat(paymentService.statement(student.getId()).totalPayments()).isEqualByComparingTo("50.00");
    }

    @Test
    void emptyCashAttachmentIsOptionalButBankTransferStillRequiresEvidence() {
        var invoice = createInvoice();
        var empty = new MockMultipartFile("receipt", "", "application/octet-stream", new byte[0]);
        assertThatThrownBy(() -> manualPaymentService.submit(student.getId(), invoice.id(), ManualPaymentMethod.BANK_TRANSFER,
                new BigDecimal("20.00"), null, null)).hasMessageContaining("Attach payment receipt");
        assertThatThrownBy(() -> manualPaymentService.submit(student.getId(), invoice.id(), ManualPaymentMethod.BANK_TRANSFER,
                new BigDecimal("20.00"), null, empty)).hasMessageContaining("Attach payment receipt");
        assertThat(transferRepository.count()).isZero();
        var cash = manualPaymentService.submit(student.getId(), invoice.id(), ManualPaymentMethod.CASH,
                new BigDecimal("20.00"), null, empty);
        assertThat(cash.receiptFileName()).isNull(); assertThat(cash.receiptFileSize()).isZero();
        manualPaymentService.review(admin.getId(), cash.id(), new ReviewManualPaymentRequest(ManualPaymentStatus.REJECTED, "No matching cash record"));
        assertThat(paymentService.statement(student.getId()).totalPayments()).isEqualByComparingTo("0.00");
    }

    @Test
    void rejectedReceiptDoesNotChangeTheBalance() {
        var invoice = createInvoice();
        var submission = manualPaymentService.submit(
                student.getId(), invoice.id(), ManualPaymentMethod.BANK_TRANSFER, new BigDecimal("180.00"), null, receipt()
        );

        manualPaymentService.review(
                admin.getId(), submission.id(), new ReviewManualPaymentRequest(ManualPaymentStatus.REJECTED, "No matching deposit")
        );

        var statement = paymentService.statement(student.getId());
        assertThat(statement.totalPayments()).isEqualByComparingTo("0.00");
        assertThat(statement.amountDue()).isEqualByComparingTo("180.00");
        assertThat(statement.invoices().getFirst().manualPayments()).singleElement().satisfies(transfer -> {
            assertThat(transfer.status()).isEqualTo(ManualPaymentStatus.REJECTED);
            assertThat(transfer.reviewNote()).isEqualTo("No matching deposit");
        });
    }

    @Test
    void onlyOneManualPaymentCanAwaitReviewForAnInvoice() {
        var invoice = createInvoice();
        manualPaymentService.submit(student.getId(), invoice.id(), ManualPaymentMethod.CASH, new BigDecimal("80.00"), null, receipt());

        assertThatThrownBy(() -> manualPaymentService.submit(
                student.getId(), invoice.id(), ManualPaymentMethod.BANK_TRANSFER, new BigDecimal("20.00"), null, receipt()
        )).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already awaiting review");
    }

    @Test
    void rejectionRequiresANonBlankReasonAndDoesNotChangeRecordsOnFailure() {
        var invoice = createInvoice();
        var submission = manualPaymentService.submit(student.getId(), invoice.id(), ManualPaymentMethod.CASH,
                new BigDecimal("20.00"), null, receipt());
        for (String note : new String[] {null, "", " \n\t "}) {
            assertThatThrownBy(() -> manualPaymentService.review(admin.getId(), submission.id(),
                    new ReviewManualPaymentRequest(ManualPaymentStatus.REJECTED, note)))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Enter a rejection reason");
            assertThat(transferRepository.findById(submission.id()).orElseThrow().getStatus()).isEqualTo(ManualPaymentStatus.PENDING);
        }
        var rejected = manualPaymentService.review(admin.getId(), submission.id(),
                new ReviewManualPaymentRequest(ManualPaymentStatus.REJECTED, "  Please upload a readable receipt.  "));
        assertThat(rejected.reviewNote()).isEqualTo("Please upload a readable receipt.");
        assertThat(rejected.invoiceBalance()).isEqualByComparingTo("180.00");
        assertThat(paymentService.statement(student.getId()).totalPayments()).isEqualByComparingTo("0.00");
    }

    @Test
    void approvalWithoutANoteRemainsValidButCannotRecordThePaymentTwice() {
        var invoice = createInvoice();
        var submission = manualPaymentService.submit(student.getId(), invoice.id(), ManualPaymentMethod.CASH,
                new BigDecimal("20.00"), null, receipt());
        var approved = manualPaymentService.review(admin.getId(), submission.id(),
                new ReviewManualPaymentRequest(ManualPaymentStatus.APPROVED, null, java.time.LocalDate.of(2026, 10, 1)));
        assertThat(approved.invoiceBalance()).isEqualByComparingTo("160.00");
        assertThatThrownBy(() -> manualPaymentService.review(admin.getId(), submission.id(),
                new ReviewManualPaymentRequest(ManualPaymentStatus.APPROVED, null, java.time.LocalDate.of(2026, 10, 1))))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("already been reviewed");
        assertThat(paymentService.statement(student.getId()).totalPayments()).isEqualByComparingTo("20.00");
    }

    @Test
    void concurrentReviewsCannotRecordTheSameReceiptTwice() throws Exception {
        var invoice = createInvoice();
        var submission = manualPaymentService.submit(student.getId(), invoice.id(), ManualPaymentMethod.CASH,
                new BigDecimal("20.00"), null, null);
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            java.util.concurrent.Callable<Boolean> approve = () -> {
                if (!start.await(5, java.util.concurrent.TimeUnit.SECONDS)) throw new IllegalStateException("Test timed out");
                try {
                    manualPaymentService.review(admin.getId(), submission.id(),
                            new ReviewManualPaymentRequest(ManualPaymentStatus.APPROVED, "Checked once", java.time.LocalDate.of(2026, 10, 1)));
                    return true;
                } catch (ResponseStatusException conflict) {
                    assertThat(conflict.getStatusCode().value()).isEqualTo(409);
                    return false;
                }
            };
            var first = executor.submit(approve);
            var second = executor.submit(approve);
            start.countDown();
            assertThat(List.of(first.get(10, java.util.concurrent.TimeUnit.SECONDS),
                    second.get(10, java.util.concurrent.TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
        }
        var statement = paymentService.statement(student.getId());
        assertThat(statement.totalPayments()).isEqualByComparingTo("20.00");
        assertThat(statement.invoices().getFirst().transactions()).hasSize(1);
    }

    @Test
    void invoiceCancelledAfterSubmissionCannotBeCreditedAndReviewIsRolledBack() {
        var invoice = createInvoice();
        var submission = manualPaymentService.submit(student.getId(), invoice.id(), ManualPaymentMethod.CASH,
                new BigDecimal("20.00"), null, receipt());
        var cancelled = invoiceRepository.findById(invoice.id()).orElseThrow();
        cancelled.setStatus(InvoiceStatus.CANCELLED); invoiceRepository.save(cancelled);
        assertThatThrownBy(() -> manualPaymentService.review(admin.getId(), submission.id(),
                new ReviewManualPaymentRequest(ManualPaymentStatus.APPROVED, null, java.time.LocalDate.of(2026, 10, 1))))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("not open");
        assertThat(transferRepository.findById(submission.id()).orElseThrow().getStatus()).isEqualTo(ManualPaymentStatus.PENDING);
        assertThat(invoiceRepository.findById(invoice.id()).orElseThrow().getStatus()).isEqualTo(InvoiceStatus.CANCELLED);
    }

    @Test
    void unsupportedReceiptIsRejectedBeforeARecordIsCreated() {
        var invoice = createInvoice();
        var invalid = new MockMultipartFile("receipt", "receipt.txt", "text/plain", "not a receipt".getBytes());

        assertThatThrownBy(() -> manualPaymentService.submit(
                student.getId(), invoice.id(), ManualPaymentMethod.CASH, new BigDecimal("20.00"), null, invalid
        )).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("PDF, JPG, PNG or WebP");
        assertThat(transferRepository.count()).isZero();
    }

    @Test
    void pendingQueueReachesBeyondOneHundredAndFiltersBeforePagination() {
        for (int i = 0; i < 101; i++) {
            var invoice = new StudentInvoice();
            invoice.setStudent(student); invoice.setCreatedByAdmin(admin); invoice.setTitle("Queue fixture " + i);
            invoice.setInvoiceNumber("QUEUE-" + i); invoice.setDueDate(LocalDate.now().plusDays(30));
            invoice.setStatus(InvoiceStatus.PENDING);
            var charge = new InvoiceLineItem(); charge.setDescription("Lessons"); charge.setType(LineItemType.CHARGE);
            charge.setAmount(new BigDecimal("100.00")); invoice.addLineItem(charge);
            invoice = invoiceRepository.save(invoice);
            var payment = new ManualPaymentSubmission(); payment.setInvoice(invoice); payment.setMethod(ManualPaymentMethod.CASH);
            payment.setAmount(new BigDecimal("20.00")); transferRepository.save(payment);
        }
        var first = manualPaymentService.pending(0, 100);
        var last = manualPaymentService.pending(1, 100);
        assertThat(first.pendingCount()).isEqualTo(101);
        assertThat(first.page().items()).hasSize(100);
        assertThat(last.page().items()).hasSize(1);
        assertThat(first.page().items()).extracting(row -> row.id()).doesNotContain(last.page().items().getFirst().id());
        assertThat(manualPaymentService.pending(1, 100).page()).isEqualTo(last.page());
        var filtered = manualPaymentService.pending(10, 10, student.getId());
        assertThat(filtered.pendingCount()).isEqualTo(101);
        assertThat(filtered.page().items()).hasSize(1);
        var unrelated = manualPaymentService.pending(0, 10, java.util.UUID.randomUUID());
        assertThat(unrelated.pendingCount()).isZero(); assertThat(unrelated.page().items()).isEmpty();
        var reviewed = transferRepository.findById(last.page().items().getFirst().id()).orElseThrow();
        reviewed.setStatus(ManualPaymentStatus.REJECTED); transferRepository.save(reviewed);
        assertThat(manualPaymentService.pending(1, 100).page().items()).isEmpty();
        assertThat(manualPaymentService.pending(0, 100).pendingCount()).isEqualTo(100);
    }

    private io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.InvoiceResponse createInvoice() {
        var invoice = paymentService.create(admin.getId(), new CreateInvoiceRequest(
                List.of(student.getId()),
                "Semester fees",
                null,
                LocalDate.now().plusDays(30),
                List.of(new LineItemRequest("Course fee", LineItemType.CHARGE, new BigDecimal("180.00"))),
                null
        )).invoices().getFirst();
        invoicePublicationService.publish(invoice.id());
        return invoice;
    }

    private MockMultipartFile receipt() {
        return new MockMultipartFile("receipt", "transfer.pdf", "application/pdf", "%PDF-1.7 demo".getBytes());
    }

    private Teacher admin() {
        Teacher result = new Teacher();
        result.setStaffNumber("ADMIN-TRANSFER");
        result.setEmail("bank-admin@example.test");
        result.setName("Bank Admin");
        result.setRole("ADMIN");
        return teacherRepository.save(result);
    }

    private Student student() {
        Student result = new Student();
        result.setStudentNumber("BANK-1001");
        result.setUniversityEmail("bank-student@example.test");
        result.setFirstName("Ada");
        result.setLastName("Student");
        result.setCourse("SOFTENG 789");
        result.setSeat("A-01");
        result.setProgramme("Engineering");
        return studentRepository.save(result);
    }
}
