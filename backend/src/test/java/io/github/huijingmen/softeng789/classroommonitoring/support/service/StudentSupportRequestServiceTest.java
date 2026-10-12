package io.github.huijingmen.softeng789.classroommonitoring.support.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestStatus;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestType;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequesterRole;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.CreateStudentSupportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.ReviewDecision;
import io.github.huijingmen.softeng789.classroommonitoring.support.dto.StudentSupportRequestDtos.ReviewStudentSupportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.support.repository.StudentSupportRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:student-support-request-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
class StudentSupportRequestServiceTest {
    @Autowired private StudentSupportRequestService service;
    @Autowired private StudentSupportRequestRepository requestRepository;
    @Autowired private StudentInvoiceRepository invoiceRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private TeacherRepository teacherRepository;

    private Student student;
    private Teacher admin;

    @BeforeEach
    void cleanDatabase() {
        requestRepository.deleteAll();
        invoiceRepository.deleteAll();
        studentRepository.deleteAll();
        teacherRepository.deleteAll();

        student = new Student();
        student.setStudentNumber("SUPPORT-1001");
        student.setUniversityEmail("student@example.test");
        student.setFirstName("Ana");
        student.setLastName("Ngata");
        student.setCourse("DANCE 101");
        student.setSeat("A-01");
        student.setProgramme("Summer programme");
        student = studentRepository.save(student);

        admin = new Teacher();
        admin.setStaffNumber("ADMIN-SUPPORT");
        admin.setEmail("support-admin@example.test");
        admin.setName("Support Admin");
        admin.setRole("ADMIN");
        admin = teacherRepository.save(admin);
    }

    @Test
    void studentQuestionUsesTheAuthenticatedStudentsContactDetails() {
        var created = service.submit(student.getId(), new CreateStudentSupportRequest(
                StudentRequestType.GENERAL,
                StudentRequesterRole.STUDENT,
                "Spoofed name",
                null,
                "spoofed@example.test",
                null,
                null,
                null,
                null,
                "Uniform question",
                "Which uniform should I bring?"
        ));

        assertThat(created.status()).isEqualTo(StudentRequestStatus.SUBMITTED);
        assertThat(created.contactName()).isEqualTo("Ana Ngata");
        assertThat(created.contactEmail()).isEqualTo("student@example.test");
        assertThat(created.type()).isEqualTo(StudentRequestType.GENERAL);
    }

    @Test
    void parentPaymentQuestionCreatesOnlyARequestAndNoInvoice() {
        var created = service.submit(student.getId(), new CreateStudentSupportRequest(
                StudentRequestType.PAYMENT_QUESTION,
                StudentRequesterRole.PARENT_GUARDIAN,
                "Mere Ngata",
                "Parent",
                "mere@example.test",
                "021 555 0101",
                null,
                null,
                null,
                "Invoice due date",
                "Could the school confirm the due date?"
        ));

        assertThat(created.contactName()).isEqualTo("Mere Ngata");
        assertThat(created.relationshipToStudent()).isEqualTo("Parent");
        assertThat(invoiceRepository.count()).isZero();

        var resolved = service.review(
                admin.getId(),
                created.id(),
                new ReviewStudentSupportRequest(ReviewDecision.RESOLVE, "The invoice is due next Friday.")
        );
        assertThat(resolved.status()).isEqualTo(StudentRequestStatus.RESOLVED);
        assertThat(resolved.reviewNote()).isEqualTo("The invoice is due next Friday.");
        assertThat(invoiceRepository.count()).isZero();
    }

    @Test
    void parentMustProvideTheirOwnContactDetails() {
        var request = new CreateStudentSupportRequest(
                StudentRequestType.GENERAL,
                StudentRequesterRole.PARENT_GUARDIAN,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "Question",
                "Please call me."
        );

        assertThatThrownBy(() -> service.submit(student.getId(), request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("parent or guardian's name");
    }
}
