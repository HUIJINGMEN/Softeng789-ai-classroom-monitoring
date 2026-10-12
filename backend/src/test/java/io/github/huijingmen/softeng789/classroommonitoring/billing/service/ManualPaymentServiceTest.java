package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentMethod;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.ManualPaymentStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
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
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:manual-payment-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.storage.payment-evidence-dir=target/test-payment-evidence"
})
@ActiveProfiles("postgres")
class ManualPaymentServiceTest {
    @Autowired private ManualPaymentService manualPaymentService;
    @Autowired private PaymentEvidenceStorage receiptStorage;
    @Autowired private PaymentService paymentService;
    @Autowired private InvoicePublicationService invoicePublicationService;
    @Autowired private ManualPaymentSubmissionRepository transferRepository;
    @Autowired private PaymentBankAccountRepository accountRepository;
    @Autowired private StudentInvoiceRepository invoiceRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private TeacherRepository teacherRepository;

    private Teacher admin;
    private Student student;

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

        manualPaymentService.review(
                admin.getId(), submission.id(), new ReviewManualPaymentRequest(ManualPaymentStatus.APPROVED, "Matched")
        );

        var statement = paymentService.statement(student.getId());
        assertThat(statement.totalPayments()).isEqualByComparingTo("80.00");
        assertThat(statement.amountDue()).isEqualByComparingTo("100.00");
        assertThat(statement.invoices().getFirst().status()).isEqualTo(InvoiceStatus.PARTIALLY_PAID);
        assertThat(statement.invoices().getFirst().transactions()).singleElement().satisfies(transaction -> {
            assertThat(transaction.provider()).isEqualTo("BANK_TRANSFER");
            assertThat(transaction.amount()).isEqualByComparingTo("80.00");
        });
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
                admin.getId(), submission.id(), new ReviewManualPaymentRequest(ManualPaymentStatus.APPROVED, "Receipt verified")
        );

        var statement = paymentService.statement(student.getId());
        assertThat(statement.amountDue()).isEqualByComparingTo("130.00");
        assertThat(statement.invoices().getFirst().transactions()).singleElement().satisfies(transaction -> {
            assertThat(transaction.provider()).isEqualTo("CASH");
            assertThat(transaction.amount()).isEqualByComparingTo("50.00");
        });
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
    void unsupportedReceiptIsRejectedBeforeARecordIsCreated() {
        var invoice = createInvoice();
        var invalid = new MockMultipartFile("receipt", "receipt.txt", "text/plain", "not a receipt".getBytes());

        assertThatThrownBy(() -> manualPaymentService.submit(
                student.getId(), invoice.id(), ManualPaymentMethod.CASH, new BigDecimal("20.00"), null, invalid
        )).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("PDF, JPG, PNG or WebP");
        assertThat(transferRepository.count()).isZero();
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
