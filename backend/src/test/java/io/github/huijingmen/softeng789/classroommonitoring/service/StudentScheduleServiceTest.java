package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AbsenceBillingPolicy;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoiceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LearningEntitlementRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LineItemRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentLearningEntitlementRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentSessionPackageRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.PaymentService;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.InvoicePublicationService;
import io.github.huijingmen.softeng789.classroommonitoring.dto.StudentScheduleDtos.CoverageStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:student-schedule-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles({"postgres", "payment-demo"})
class StudentScheduleServiceTest {
    @Autowired private StudentScheduleService scheduleService;
    @Autowired private PaymentService paymentService;
    @Autowired private InvoicePublicationService invoicePublicationService;
    @Autowired private StudentInvoiceRepository invoiceRepository;
    @Autowired private StudentLearningEntitlementRepository entitlementRepository;
    @Autowired private StudentSessionPackageRepository packageRepository;
    @Autowired private AttendanceRecordRepository attendanceRepository;
    @Autowired private ClassroomSessionRepository sessionRepository;
    @Autowired private CourseEnrollmentRepository enrollmentRepository;
    @Autowired private CourseOfferingRepository offeringRepository;
    @Autowired private CourseRepository courseRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private TeacherRepository teacherRepository;

    private Student student;
    private Teacher admin;
    private CourseOffering offering;

    @BeforeEach
    void setUp() {
        packageRepository.deleteAll();
        invoiceRepository.deleteAll();
        entitlementRepository.deleteAll();
        attendanceRepository.deleteAll();
        sessionRepository.deleteAll();
        enrollmentRepository.deleteAll();
        offeringRepository.deleteAll();
        courseRepository.deleteAll();
        studentRepository.deleteAll();
        teacherRepository.deleteAll();

        student = new Student();
        student.setStudentNumber("DANCE-01");
        student.setUniversityEmail("dance-01@example.test");
        student.setFirstName("Mia");
        student.setLastName("Chen");
        student.setCourse("DANCE 101");
        student.setSeat("A1");
        student.setProgramme("Summer Dance");
        studentRepository.save(student);

        admin = new Teacher();
        admin.setStaffNumber("ADMIN-1");
        admin.setEmail("admin@example.test");
        admin.setName("Admin User");
        admin.setRole("ADMIN");
        teacherRepository.save(admin);

        Course course = new Course();
        course.setCode("DANCE 101");
        course.setName("Summer Dance");
        courseRepository.save(course);
        offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode("DANCE-101-SUMMER");
        offering.setAcademicTerm("Summer 2027");
        offering.setPurchaseMode(CoursePurchaseMode.LESSON_PACKAGE);
        offering.setDefaultSessionCount(2);
        offering.setAbsencePolicy(AbsenceBillingPolicy.CONSUME_UNEXCUSED);
        offering.getTeachers().add(admin);
        offeringRepository.save(offering);

        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(student);
        enrollment.setCourseOffering(offering);
        enrollmentRepository.save(enrollment);
    }

    @Test
    void scheduleCombinesTimetableAttendanceAndPaidLessonCoverage() {
        LocalDate start = LocalDate.now().plusDays(1);
        ClassroomSession first = session(start, SessionStatus.SCHEDULED);
        session(start.plusDays(1), SessionStatus.SCHEDULED);
        ClassroomSession uncovered = session(start.plusDays(2), SessionStatus.COMPLETED);
        AttendanceRecord attendance = new AttendanceRecord();
        attendance.setStudent(student);
        attendance.setSession(uncovered);
        attendance.setStatus(AttendanceStatus.PRESENT);
        attendanceRepository.save(attendance);

        var invoice = paymentService.create(admin.getId(), new CreateInvoiceRequest(
                List.of(student.getId()),
                "Two dance lessons",
                null,
                LocalDate.now().plusDays(14),
                List.of(new LineItemRequest("2 lessons", LineItemType.CHARGE, new BigDecimal("200.00"))),
                new LearningEntitlementRequest(
                        offering.getId(), CoursePurchaseMode.LESSON_PACKAGE,
                        start, start.plusDays(30), 2,
                        AbsenceBillingPolicy.CONSUME_UNEXCUSED, null
                )
        )).invoices().getFirst();

        var privateDraft = scheduleService.schedule(student.getId());
        assertThat(privateDraft.summary().pendingPaymentLessons()).isZero();
        invoicePublicationService.publish(invoice.id());
        var awaitingPayment = scheduleService.schedule(student.getId());
        assertThat(awaitingPayment.summary().pendingPaymentLessons()).isEqualTo(2);
        assertThat(awaitingPayment.summary().coveredUpcomingSessions()).isZero();

        paymentService.checkout(student.getId(), invoice.id());
        var schedule = scheduleService.schedule(student.getId());

        assertThat(schedule.sessions()).hasSize(3);
        assertThat(schedule.sessions()).filteredOn(row -> row.id().equals(first.getId())).singleElement()
                .extracting(row -> row.coverageStatus())
                .isEqualTo(CoverageStatus.COVERED);
        assertThat(schedule.sessions()).filteredOn(row -> row.id().equals(uncovered.getId())).singleElement()
                .satisfies(row -> {
                    assertThat(row.attendanceStatus()).isEqualTo(AttendanceStatus.PRESENT);
                    assertThat(row.coverageStatus()).isEqualTo(CoverageStatus.UNPAID_ATTENDANCE);
                });
        assertThat(schedule.summary().activeLessons()).isEqualTo(2);
        assertThat(schedule.summary().remainingLessons()).isEqualTo(2);
        assertThat(schedule.summary().pendingPaymentLessons()).isZero();
    }

    private ClassroomSession session(LocalDate date, SessionStatus status) {
        ClassroomSession session = new ClassroomSession();
        session.setCourse(offering.getCourse().getCode());
        session.setCourseOffering(offering);
        session.setTeacher(admin);
        session.setRoom("Studio A");
        session.setDate(date);
        session.setStartTime(Instant.parse("2027-01-05T09:00:00Z"));
        session.setEndTime(Instant.parse("2027-01-05T10:00:00Z"));
        session.setStatus(status);
        return sessionRepository.save(session);
    }
}
