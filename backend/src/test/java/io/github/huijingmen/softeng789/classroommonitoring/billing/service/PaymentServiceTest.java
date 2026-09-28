package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoiceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LineItemRequest;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:payment-service-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class PaymentServiceTest {
    @Autowired private PaymentService service;
    @Autowired private StudentInvoiceRepository invoiceRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private TeacherRepository teacherRepository;

    private Teacher admin;
    private Student student;

    @BeforeEach
    void cleanDatabase() {
        invoiceRepository.deleteAll();
        studentRepository.deleteAll();
        teacherRepository.deleteAll();
        admin = admin();
        student = student("TEST-1001", "Ada");
    }

    @Test
    void adminCreatesOneItemisedStatementForEverySelectedStudent() {
        Student second = student("TEST-1002", "Grace");

        var response = service.create(admin.getId(), request(
                List.of(student.getId(), second.getId()),
                new LineItemRequest("Tuition fee", LineItemType.CHARGE, new BigDecimal("4200.00")),
                new LineItemRequest("Scholarship", LineItemType.CREDIT, new BigDecimal("500.00"))
        ));

        assertThat(response.invoices()).hasSize(2).allSatisfy(invoice -> {
            assertThat(invoice.status()).isEqualTo(InvoiceStatus.PENDING);
            assertThat(invoice.charges()).isEqualByComparingTo("4200.00");
            assertThat(invoice.credits()).isEqualByComparingTo("500.00");
            assertThat(invoice.balance()).isEqualByComparingTo("3700.00");
            assertThat(invoice.lineItems()).hasSize(2);
        });
    }

    @Test
    void studentStatementShowsChargesCreditsPaymentsAndCurrentBalance() {
        var invoice = service.create(admin.getId(), request(
                List.of(student.getId()),
                new LineItemRequest("Course fee", LineItemType.CHARGE, new BigDecimal("180.00")),
                new LineItemRequest("Adjustment", LineItemType.CREDIT, new BigDecimal("30.00"))
        )).invoices().getFirst();

        var beforePayment = service.statement(student.getId());
        assertThat(beforePayment.totalCharges()).isEqualByComparingTo("180.00");
        assertThat(beforePayment.totalCredits()).isEqualByComparingTo("30.00");
        assertThat(beforePayment.amountDue()).isEqualByComparingTo("150.00");

        var checkout = service.checkout(student.getId(), invoice.id());
        assertThat(checkout.invoice().status()).isEqualTo(InvoiceStatus.PAID);
        assertThat(checkout.invoice().balance()).isEqualByComparingTo("0.00");

        var afterPayment = service.statement(student.getId());
        assertThat(afterPayment.totalPayments()).isEqualByComparingTo("150.00");
        assertThat(afterPayment.amountDue()).isEqualByComparingTo("0.00");
    }

    @Test
    void adminSummaryUsesAggregatedFinancialTotals() {
        service.create(admin.getId(), request(
                List.of(student.getId()),
                new LineItemRequest("Tuition fee", LineItemType.CHARGE, new BigDecimal("1000.00")),
                new LineItemRequest("Scholarship", LineItemType.CREDIT, new BigDecimal("250.00"))
        ));

        var response = service.adminList("", null, 0, 10);

        assertThat(response.page().items()).hasSize(1);
        assertThat(response.summary().outstanding()).isEqualByComparingTo("750.00");
        assertThat(response.summary().collected()).isEqualByComparingTo("0.00");
        assertThat(response.summary().openCount()).isEqualTo(1);
    }

    @Test
    void adminDirectoryRefreshesPastDueRequestsBeforeReturningResults() {
        service.create(admin.getId(), request(
                List.of(student.getId()),
                new LineItemRequest("Course fee", LineItemType.CHARGE, new BigDecimal("180.00"))
        ));
        var invoice = invoiceRepository.findAll().getFirst();
        invoice.setDueDate(LocalDate.now().minusDays(1));
        invoice.setStatus(InvoiceStatus.PENDING);
        invoiceRepository.saveAndFlush(invoice);

        var response = service.adminList("", null, 0, 10);

        assertThat(response.page().items()).singleElement()
                .extracting(item -> item.status())
                .isEqualTo(InvoiceStatus.OVERDUE);
        assertThat(response.summary().overdueCount()).isEqualTo(1);
    }

    @Test
    void creditsCannotExceedCharges() {
        CreateInvoiceRequest invalid = request(
                List.of(student.getId()),
                new LineItemRequest("Charge", LineItemType.CHARGE, new BigDecimal("50.00")),
                new LineItemRequest("Credit", LineItemType.CREDIT, new BigDecimal("60.00"))
        );

        assertThatThrownBy(() -> service.create(admin.getId(), invalid))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Charges must be greater than credits");
    }

    private CreateInvoiceRequest request(List<java.util.UUID> studentIds, LineItemRequest... lineItems) {
        return new CreateInvoiceRequest(
                studentIds,
                "2026 Semester Two fees",
                "Current teaching period.",
                LocalDate.now().plusDays(30),
                List.of(lineItems)
        );
    }

    private Teacher admin() {
        Teacher teacher = new Teacher();
        teacher.setStaffNumber("ADMIN-1");
        teacher.setEmail("admin@example.test");
        teacher.setName("System Admin");
        teacher.setRole("ADMIN");
        return teacherRepository.save(teacher);
    }

    private Student student(String number, String firstName) {
        Student result = new Student();
        result.setStudentNumber(number);
        result.setUniversityEmail(number.toLowerCase() + "@example.test");
        result.setFirstName(firstName);
        result.setLastName("Student");
        result.setCourse("SOFTENG 789");
        result.setSeat("A-01");
        result.setProgramme("Engineering");
        return studentRepository.save(result);
    }
}
