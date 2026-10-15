package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.InvoiceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LineItemType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AbsenceBillingPolicy;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.CoursePurchaseMode;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LearningEntitlementStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.MembershipInterval;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.PayPerLessonTrigger;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AttendanceBillingDecision;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CreateInvoiceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CoursePurchaseRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LearningEntitlementRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.LineItemRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.UpdateAttendanceBillingRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.ChargeSuggestionPreviewRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.ChargeSuggestionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.CreateStudentInvoiceBatchRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.InvoiceSuggestionDtos.StudentInvoiceDraftRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.AccountAdjustmentRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.BillingOperationsDtos.ManageSessionPackageRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.AccountAdjustmentType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.SessionPackageAction;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.StudentPaymentAccountState;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.ScheduleMakeupRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditEventType;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentInvoiceRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentLearningEntitlementRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.StudentSessionPackageRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.AttendanceBillingOverrideRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.LessonCreditRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.BillingAccountActivityRepository;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession.SessionStatus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Campus;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Room;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassroomSessionRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CampusRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.RoomRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
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
    @Autowired private InvoiceSuggestionService suggestionService;
    @Autowired private InvoicePublicationService invoicePublicationService;
    @Autowired private StudentInvoiceRepository invoiceRepository;
    @Autowired private StudentLearningEntitlementRepository entitlementRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private TeacherRepository teacherRepository;
    @Autowired private SessionPackageService sessionPackageService;
    @Autowired private CourseRepository courseRepository;
    @Autowired private CourseOfferingRepository offeringRepository;
    @Autowired private CourseEnrollmentRepository enrollmentRepository;
    @Autowired private ClassroomSessionRepository sessionRepository;
    @Autowired private CampusRepository campusRepository;
    @Autowired private RoomRepository roomRepository;
    @Autowired private AttendanceRecordRepository attendanceRepository;
    @Autowired private StudentSessionPackageRepository packageRepository;
    @Autowired private AttendanceBillingOverrideRepository billingOverrideRepository;
    @Autowired private LessonCreditRepository lessonCreditRepository;
    @Autowired private LessonCreditManagementService lessonCreditService;
    @Autowired private LessonReconciliationService reconciliationService;
    @Autowired private BillingAccountService billingAccountService;
    @Autowired private BillingAccountActivityRepository accountActivityRepository;
    @Autowired private StudentPaymentAccountService studentPaymentAccountService;

    private Teacher admin;
    private Student student;

    @BeforeEach
    void cleanDatabase() {
        accountActivityRepository.deleteAll();
        billingOverrideRepository.deleteAll();
        packageRepository.deleteAll();
        invoiceRepository.deleteAll();
        entitlementRepository.deleteAll();
        attendanceRepository.deleteAll();
        sessionRepository.deleteAll();
        roomRepository.deleteAll();
        campusRepository.deleteAll();
        enrollmentRepository.deleteAll();
        offeringRepository.deleteAll();
        courseRepository.deleteAll();
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
            assertThat(invoice.status()).isEqualTo(InvoiceStatus.DRAFT);
            assertThat(invoice.charges()).isEqualByComparingTo("4200.00");
            assertThat(invoice.credits()).isEqualByComparingTo("500.00");
            assertThat(invoice.balance()).isEqualByComparingTo("3700.00");
            assertThat(invoice.lineItems()).hasSize(2);
        });
    }

    @Test
    void studentPaymentDirectoryMovesOneStudentThroughBillingAndPaymentStates() {
        CourseOffering offering = activeOfferingFor(student, CoursePurchaseMode.COURSE_ENROLMENT);

        var unbilled = studentPaymentAccountService.directory("", null, 0, 20);
        assertThat(unbilled.page().items()).singleElement().satisfies(row -> {
            assertThat(row.studentId()).isEqualTo(student.getId());
            assertThat(row.state()).isEqualTo(StudentPaymentAccountState.NEEDS_INVOICE);
            assertThat(row.unbilledCourseCount()).isEqualTo(1);
        });

        var draft = service.create(admin.getId(), new CreateInvoiceRequest(
                List.of(student.getId()),
                "Course payment notice",
                "Current course enrolment.",
                LocalDate.now().plusDays(14),
                List.of(new LineItemRequest("Course fee", LineItemType.CHARGE, new BigDecimal("240.00"))),
                new LearningEntitlementRequest(
                        offering.getId(), CoursePurchaseMode.COURSE_ENROLMENT,
                        null, null, null, null, null
                )
        )).invoices().getFirst();

        assertThat(studentPaymentAccountService.directory("", null, 0, 20).page().items())
                .singleElement().satisfies(row -> assertThat(row.state())
                        .isEqualTo(StudentPaymentAccountState.DRAFT));

        invoicePublicationService.publish(draft.id());
        assertThat(studentPaymentAccountService.directory("", null, 0, 20).page().items())
                .singleElement().satisfies(row -> assertThat(row.state())
                        .isEqualTo(StudentPaymentAccountState.PAYMENT_DUE));

        service.checkout(student.getId(), draft.id());
        assertThat(studentPaymentAccountService.directory("", null, 0, 20).page().items())
                .singleElement().satisfies(row -> {
                    assertThat(row.state()).isEqualTo(StudentPaymentAccountState.PAID);
                    assertThat(row.balance()).isEqualByComparingTo("0.00");
                    assertThat(row.received()).isEqualByComparingTo("240.00");
                });
    }

    @Test
    void oneInvoiceCanCreateIndependentPurchasesForMultipleCourses() {
        CourseOffering hipHop = activeOfferingFor(student, CoursePurchaseMode.LESSON_PACKAGE, "DANCE 101");
        CourseOffering ballet = activeOfferingFor(student, CoursePurchaseMode.LESSON_PACKAGE, "DANCE 202");
        LocalDate start = LocalDate.now().plusDays(1);
        scheduledSession(hipHop, start);
        scheduledSession(ballet, start.plusDays(1));

        var request = new CreateInvoiceRequest(
                List.of(student.getId()),
                "Summer dance programme",
                "Two courses on one invoice.",
                LocalDate.now().plusDays(14),
                List.of(new LineItemRequest("Registration fee", LineItemType.CHARGE, new BigDecimal("30.00"))),
                List.of(
                        new CoursePurchaseRequest(
                                "Hip Hop · 10 lessons", new BigDecimal("300.00"),
                                new LearningEntitlementRequest(
                                        hipHop.getId(), CoursePurchaseMode.LESSON_PACKAGE,
                                        start, start.plusMonths(3), 10,
                                        AbsenceBillingPolicy.CONSUME_UNEXCUSED, null
                                )
                        ),
                        new CoursePurchaseRequest(
                                "Ballet · 10 lessons", new BigDecimal("300.00"),
                                new LearningEntitlementRequest(
                                        ballet.getId(), CoursePurchaseMode.LESSON_PACKAGE,
                                        start, start.plusMonths(3), 10,
                                        AbsenceBillingPolicy.ATTENDANCE_ONLY, null
                                )
                        )
                ),
                null
        );

        var created = service.create(admin.getId(), request).invoices().getFirst();

        assertThat(created.charges()).isEqualByComparingTo("630.00");
        assertThat(created.lineItems()).extracting(item -> item.description())
                .containsExactly("Hip Hop · 10 lessons", "Ballet · 10 lessons", "Registration fee");
        assertThat(created.coursePurchases()).hasSize(2)
                .allSatisfy(purchase -> assertThat(purchase.sessionPackage()).isNotNull());
        assertThat(packageRepository.findByInvoice_IdOrderByCreatedAtAsc(created.id())).hasSize(2);

        invoicePublicationService.publish(created.id());
        var paid = checkout(student.getId(), created.id()).invoice();
        assertThat(paid.coursePurchases()).hasSize(2)
                .allSatisfy(purchase -> {
                    assertThat(purchase.entitlement().status()).isEqualTo(LearningEntitlementStatus.ACTIVE);
                    assertThat(purchase.sessionPackage().status()).isEqualTo("ACTIVE");
                });
    }

    @Test
    void chargePreviewListsEveryEnrolledCourseAsAnIndependentDecision() {
        CourseOffering fullCourse = activeOfferingFor(student, CoursePurchaseMode.COURSE_ENROLMENT, "COMPSCI 335");
        CourseOffering membership = activeOfferingFor(student, CoursePurchaseMode.MEMBERSHIP, "DANCE 210");
        CourseOffering lessonPackage = activeOfferingFor(student, CoursePurchaseMode.LESSON_PACKAGE, "BALLET 101");
        CourseOffering singleLesson = activeOfferingFor(student, CoursePurchaseMode.PAY_PER_LESSON, "PIANO 110");
        List.of(fullCourse, membership, lessonPackage, singleLesson).forEach(offering -> {
            offering.setDefaultPrice(new BigDecimal("120.00"));
            offeringRepository.save(offering);
        });
        lessonPackage.setPackageValidityDays(90);
        offeringRepository.save(lessonPackage);
        ClassroomSession lesson = scheduledSession(singleLesson, LocalDate.now().plusDays(2));

        var preview = suggestionService.preview(new ChargeSuggestionPreviewRequest(
                List.of(student.getId()), fullCourse.getId(), LocalDate.now()
        ));

        assertThat(preview.students()).singleElement().satisfies(studentPreview -> {
            assertThat(studentPreview.courses()).hasSize(4);
            assertThat(studentPreview.courses()).extracting(course -> course.courseCode())
                    .containsExactly("COMPSCI 335", "BALLET 101", "DANCE 210", "PIANO 110");
            assertThat(studentPreview.courses()).allSatisfy(course ->
                    assertThat(course.status()).isEqualTo(ChargeSuggestionStatus.READY));
            assertThat(studentPreview.courses().getFirst().preferredCourse()).isTrue();
            assertThat(studentPreview.courses().getFirst().selectedByDefault()).isTrue();
            assertThat(studentPreview.courses().subList(1, 4))
                    .allSatisfy(course -> assertThat(course.selectedByDefault()).isFalse());
            var lessonSuggestion = studentPreview.courses().stream()
                    .filter(course -> course.courseOfferingId().equals(singleLesson.getId()))
                    .findFirst().orElseThrow();
            assertThat(lessonSuggestion.availableSessions()).singleElement()
                    .satisfies(session -> assertThat(session.id()).isEqualTo(lesson.getId()));
        });
    }

    @Test
    void studentSpecificBatchCreatesOneCombinedInvoiceWithFourCourseItems() {
        CourseOffering first = activeOfferingFor(student, CoursePurchaseMode.COURSE_ENROLMENT, "COMPSCI 335");
        CourseOffering second = activeOfferingFor(student, CoursePurchaseMode.COURSE_ENROLMENT, "COMPSCI 726");
        CourseOffering third = activeOfferingFor(student, CoursePurchaseMode.COURSE_ENROLMENT, "DANCE 101");
        CourseOffering fourth = activeOfferingFor(student, CoursePurchaseMode.COURSE_ENROLMENT, "MUSIC 110");
        List<CourseOffering> offerings = List.of(first, second, third, fourth);
        offerings.forEach(offering -> {
            offering.setDefaultPrice(new BigDecimal("250.00"));
            offeringRepository.save(offering);
        });
        List<CoursePurchaseRequest> purchases = offerings.stream().map(offering -> new CoursePurchaseRequest(
                offering.getCourse().getCode() + " course fee",
                offering.getDefaultPrice(),
                new LearningEntitlementRequest(
                        offering.getId(), CoursePurchaseMode.COURSE_ENROLMENT,
                        null, null, null, null, null
                )
        )).toList();

        var response = service.createStudentBatch(admin.getId(), new CreateStudentInvoiceBatchRequest(List.of(
                new StudentInvoiceDraftRequest(
                        student.getId(), "2026 course fees", null, LocalDate.now().plusDays(14),
                        List.of(), purchases
                )
        )));

        assertThat(response.invoices()).singleElement().satisfies(invoice -> {
            assertThat(invoice.lineItems()).hasSize(4);
            assertThat(invoice.coursePurchases()).hasSize(4);
            assertThat(invoice.balance()).isEqualByComparingTo("1000.00");
        });
    }

    @Test
    void chargePreviewKeepsPreviouslyInvoicedCoursesVisibleButUnselected() {
        CourseOffering offering = activeOfferingFor(student, CoursePurchaseMode.COURSE_ENROLMENT, "COMPSCI 335");
        offering.setDefaultPrice(new BigDecimal("250.00"));
        offeringRepository.save(offering);
        service.createStudentBatch(admin.getId(), new CreateStudentInvoiceBatchRequest(List.of(
                new StudentInvoiceDraftRequest(
                        student.getId(), "2026 course fees", null, LocalDate.now().plusDays(14),
                        List.of(), List.of(new CoursePurchaseRequest(
                                "COMPSCI 335 course fee", new BigDecimal("250.00"),
                                new LearningEntitlementRequest(
                                        offering.getId(), CoursePurchaseMode.COURSE_ENROLMENT,
                                        null, null, null, null, null
                                )
                        ))
                )
        )));

        var preview = suggestionService.preview(new ChargeSuggestionPreviewRequest(
                List.of(student.getId()), null, LocalDate.now()
        ));

        assertThat(preview.students()).singleElement().satisfies(studentPreview ->
                assertThat(studentPreview.courses()).singleElement().satisfies(course -> {
                    assertThat(course.status()).isEqualTo(ChargeSuggestionStatus.ALREADY_BILLED);
                    assertThat(course.selectedByDefault()).isFalse();
                    assertThat(course.previousInvoiceNumber()).isNotBlank();
                })
        );
    }

    @Test
    void studentStatementShowsChargesCreditsPaymentsAndCurrentBalance() {
        var invoice = service.create(admin.getId(), request(
                List.of(student.getId()),
                new LineItemRequest("Course fee", LineItemType.CHARGE, new BigDecimal("180.00")),
                new LineItemRequest("Adjustment", LineItemType.CREDIT, new BigDecimal("30.00"))
        )).invoices().getFirst();

        var privateDraft = service.statement(student.getId());
        assertThat(privateDraft.invoices()).isEmpty();
        assertThat(privateDraft.amountDue()).isZero();

        invoicePublicationService.publish(invoice.id());
        var beforePayment = service.statement(student.getId());
        assertThat(beforePayment.totalCharges()).isEqualByComparingTo("180.00");
        assertThat(beforePayment.totalCredits()).isEqualByComparingTo("30.00");
        assertThat(beforePayment.amountDue()).isEqualByComparingTo("150.00");

        var checkout = checkout(student.getId(), invoice.id());
        assertThat(checkout.invoice().status()).isEqualTo(InvoiceStatus.PAID);
        assertThat(checkout.invoice().balance()).isEqualByComparingTo("0.00");

        var afterPayment = service.statement(student.getId());
        assertThat(afterPayment.totalPayments()).isEqualByComparingTo("150.00");
        assertThat(afterPayment.amountDue()).isEqualByComparingTo("0.00");
    }

    @Test
    void refundsAndReversalsRemainAuditableAndUseNetPayments() {
        var created = service.create(admin.getId(), request(
                List.of(student.getId()),
                new LineItemRequest("Course fee", LineItemType.CHARGE, new BigDecimal("180.00"))
        )).invoices().getFirst();
        checkout(student.getId(), created.id());

        var refunded = billingAccountService.adjust(
                admin.getId(), created.id(),
                new AccountAdjustmentRequest(AccountAdjustmentType.REFUND, new BigDecimal("40.00"),
                        "Student withdrew before the final workshop", "BANK-REFUND-1042")
        );

        assertThat(refunded.invoice().credits()).isEqualByComparingTo("40.00");
        assertThat(refunded.invoice().payments()).isEqualByComparingTo("140.00");
        assertThat(refunded.invoice().balance()).isEqualByComparingTo("0.00");
        assertThat(refunded.invoice().status()).isEqualTo(InvoiceStatus.PAID);
        assertThat(refunded.activities()).singleElement().satisfies(activity -> {
            assertThat(activity.type().name()).isEqualTo("REFUND_ISSUED");
            assertThat(activity.reason()).contains("withdrew");
            assertThat(activity.externalReference()).isEqualTo("BANK-REFUND-1042");
            assertThat(activity.actorName()).isEqualTo("System Admin");
        });

        var reversed = billingAccountService.adjust(
                admin.getId(), created.id(),
                new AccountAdjustmentRequest(AccountAdjustmentType.PAYMENT_REVERSAL, new BigDecimal("20.00"),
                        "Duplicate cash receipt", null)
        );
        assertThat(reversed.invoice().payments()).isEqualByComparingTo("120.00");
        assertThat(reversed.invoice().balance()).isEqualByComparingTo("20.00");
        assertThat(reversed.invoice().status()).isEqualTo(InvoiceStatus.PARTIALLY_PAID);
        assertThat(reversed.activities()).hasSize(2);
        var summary = service.adminList("", null, 0, 10).summary();
        assertThat(summary.collected()).isEqualByComparingTo("120.00");
        assertThat(summary.outstanding()).isEqualByComparingTo("20.00");
    }

    @Test
    void externalRefundRequiresTheReferenceFromTheBankOrPaymentProvider() {
        var created = service.create(admin.getId(), request(
                List.of(student.getId()),
                new LineItemRequest("Course fee", LineItemType.CHARGE, new BigDecimal("180.00"))
        )).invoices().getFirst();
        checkout(student.getId(), created.id());

        assertThatThrownBy(() -> billingAccountService.adjust(
                admin.getId(), created.id(),
                new AccountAdjustmentRequest(AccountAdjustmentType.REFUND, new BigDecimal("40.00"),
                        "Student withdrew", " ")
        )).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("bank or payment-provider reference");
    }

    @Test
    void transferPreservesOriginalRevenueAndMovesOnlyRemainingLessonObligations() {
        // Billing periods use the business date, independent of the CI runner's default zone.
        LocalDate today = BillingDates.today();
        CourseOffering source = activeOfferingFor(student, CoursePurchaseMode.LESSON_PACKAGE, "DANCE 101");
        CourseOffering target = activeOfferingFor(student, CoursePurchaseMode.LESSON_PACKAGE, "DANCE 202");
        LocalDate start = today.minusDays(1);
        attendance(completedSession(source, start), AttendanceStatus.PRESENT);
        scheduledSession(source, start.plusDays(2));
        scheduledSession(source, start.plusDays(3));
        scheduledSession(target, start.plusDays(2));
        scheduledSession(target, start.plusDays(3));

        var created = service.create(admin.getId(), packageRequest(source, start, 3, "Three dance lessons"))
                .invoices().getFirst();
        checkout(student.getId(), created.id());

        var accountBefore = billingAccountService.account(created.id());
        assertThat(accountBefore.transferOptions())
                .extracting(option -> option.courseOfferingId())
                .containsExactly(target.getId());

        var transferred = billingAccountService.managePackage(
                admin.getId(), created.sessionPackage().id(),
                new ManageSessionPackageRequest(
                        SessionPackageAction.TRANSFER, null, target.getId(), "Moved to the later class"
                )
        );

        var accountAfterTransfer = billingAccountService.account(created.id());
        assertThat(accountAfterTransfer.invoice().entitlement().courseOfferingId()).isEqualTo(source.getId());
        assertThat(transferred.sessionPackage().courseOfferingId()).isEqualTo(target.getId());

        var operations = billingAccountService.operationsDashboard(today.minusDays(1), today);
        var sourceStats = operations.courses().stream()
                .filter(item -> item.courseOfferingId().equals(source.getId()))
                .findFirst().orElseThrow();
        var targetStats = operations.courses().stream()
                .filter(item -> item.courseOfferingId().equals(target.getId()))
                .findFirst().orElseThrow();
        assertThat(sourceStats.netReceived()).isEqualByComparingTo("300.00");
        assertThat(sourceStats.purchasedLessons()).isEqualTo(1);
        assertThat(sourceStats.usedLessons()).isEqualTo(1);
        assertThat(targetStats.netReceived()).isEqualByComparingTo("0.00");
        assertThat(targetStats.purchasedLessons()).isEqualTo(2);
        assertThat(targetStats.usedLessons()).isZero();

        var accountAfter = billingAccountService.account(created.id());
        assertThat(accountAfter.timeline())
                .extracting(event -> event.title())
                .contains("Invoice created", "Payment received", "Remaining lessons transferred");
    }

    @Test
    void packagePauseReleasesFutureBookingsAndResumeAllocatesThemAgain() {
        CourseOffering offering = activeOfferingFor(student);
        LocalDate start = LocalDate.now().plusDays(1);
        scheduledSession(offering, start);
        scheduledSession(offering, start.plusDays(1));
        scheduledSession(offering, start.plusDays(2));
        var created = service.create(admin.getId(), packageRequest(offering, start, 3, "Three lessons"))
                .invoices().getFirst();
        checkout(student.getId(), created.id());

        var paused = billingAccountService.managePackage(
                admin.getId(), created.sessionPackage().id(),
                new ManageSessionPackageRequest(SessionPackageAction.PAUSE, null, null,
                        "Medical leave for two weeks")
        );
        assertThat(paused.sessionPackage().status()).isEqualTo("PAUSED");
        assertThat(lessonCreditRepository.findAll())
                .extracting(LessonCredit::getStatus)
                .containsOnly(LessonCreditStatus.AVAILABLE);

        var resumed = billingAccountService.managePackage(
                admin.getId(), created.sessionPackage().id(),
                new ManageSessionPackageRequest(SessionPackageAction.RESUME, null, null,
                        "Student cleared to return")
        );
        assertThat(resumed.sessionPackage().status()).isEqualTo("ACTIVE");
        assertThat(lessonCreditRepository.findAll())
                .extracting(LessonCredit::getStatus)
                .containsOnly(LessonCreditStatus.BOOKED);
        assertThat(resumed.activities()).hasSize(2);
    }

    @Test
    void adminSummaryUsesAggregatedFinancialTotals() {
        var created = service.create(admin.getId(), request(
                List.of(student.getId()),
                new LineItemRequest("Tuition fee", LineItemType.CHARGE, new BigDecimal("1000.00")),
                new LineItemRequest("Scholarship", LineItemType.CREDIT, new BigDecimal("250.00"))
        )).invoices().getFirst();
        invoicePublicationService.publish(created.id());

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

    @Test
    void fullCoursePurchaseFollowsTimetableAndActivatesAfterPayment() {
        CourseOffering offering = activeOfferingFor(student, CoursePurchaseMode.COURSE_ENROLMENT);
        LocalDate firstDate = LocalDate.now().plusDays(4);
        scheduledSession(offering, firstDate);
        scheduledSession(offering, firstDate.plusDays(14));

        var created = service.create(admin.getId(), new CreateInvoiceRequest(
                List.of(student.getId()),
                "Summer programme",
                "Full programme access.",
                LocalDate.now().plusDays(7),
                List.of(new LineItemRequest("Course enrolment", LineItemType.CHARGE, new BigDecimal("900.00"))),
                new LearningEntitlementRequest(
                        offering.getId(), CoursePurchaseMode.COURSE_ENROLMENT,
                        null, null, null, null, null
                )
        )).invoices().getFirst();

        assertThat(created.entitlement().status()).isEqualTo(LearningEntitlementStatus.PENDING_PAYMENT);
        assertThat(created.entitlement().validFrom()).isEqualTo(firstDate);
        assertThat(created.entitlement().validTo()).isEqualTo(firstDate.plusDays(14));
        assertThat(created.sessionPackage()).isNull();

        var paid = checkout(student.getId(), created.id()).invoice();
        assertThat(paid.entitlement().status()).isEqualTo(LearningEntitlementStatus.ACTIVE);

        assertThatThrownBy(() -> service.create(admin.getId(), new CreateInvoiceRequest(
                List.of(student.getId()), "Duplicate course", null, LocalDate.now().plusDays(7),
                List.of(new LineItemRequest("Course enrolment", LineItemType.CHARGE, new BigDecimal("900.00"))),
                new LearningEntitlementRequest(
                        offering.getId(), CoursePurchaseMode.COURSE_ENROLMENT,
                        null, null, null, null, null
                )
        ))).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already has a current enrolment purchase");
    }

    @Test
    void membershipPurchaseRecordsItsAccessWindowWithoutCreatingLessonCredits() {
        CourseOffering offering = activeOfferingFor(student, CoursePurchaseMode.MEMBERSHIP);
        LocalDate from = LocalDate.now().plusDays(1);
        LocalDate to = from.plusMonths(1).minusDays(1);

        var created = service.create(admin.getId(), new CreateInvoiceRequest(
                List.of(student.getId()), "Monthly studio membership", null, LocalDate.now().plusDays(7),
                List.of(new LineItemRequest("Monthly membership", LineItemType.CHARGE, new BigDecimal("160.00"))),
                new LearningEntitlementRequest(
                        offering.getId(), CoursePurchaseMode.MEMBERSHIP,
                        from, to, null, null, null
                )
        )).invoices().getFirst();

        assertThat(created.entitlement().purchaseMode()).isEqualTo(CoursePurchaseMode.MEMBERSHIP);
        assertThat(created.entitlement().validFrom()).isEqualTo(from);
        assertThat(created.entitlement().validTo()).isEqualTo(to);
        assertThat(created.entitlement().sessionAllowance()).isEqualTo(8);
        assertThat(packageRepository.count()).isZero();
        assertThat(lessonCreditRepository.count()).isZero();
    }

    @Test
    void payPerLessonPurchaseLinksOneSessionAndPreventsDuplicateCharges() {
        CourseOffering offering = activeOfferingFor(student, CoursePurchaseMode.PAY_PER_LESSON);
        ClassroomSession lesson = scheduledSession(offering, LocalDate.now().plusDays(3));
        CreateInvoiceRequest request = new CreateInvoiceRequest(
                List.of(student.getId()), "Drop-in lesson", null, LocalDate.now().plusDays(7),
                List.of(new LineItemRequest("Single lesson", LineItemType.CHARGE, new BigDecimal("30.00"))),
                new LearningEntitlementRequest(
                        offering.getId(), CoursePurchaseMode.PAY_PER_LESSON,
                        null, null, null, null, lesson.getId()
                )
        );

        var created = service.create(admin.getId(), request).invoices().getFirst();
        assertThat(created.entitlement().classroomSessionId()).isEqualTo(lesson.getId());
        assertThat(created.entitlement().sessionAllowance()).isEqualTo(1);
        assertThat(created.entitlement().validFrom()).isEqualTo(lesson.getDate());
        assertThatThrownBy(() -> service.create(admin.getId(), request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already been charged for this lesson");
    }

    @Test
    void sessionPackageUsesAttendanceAndAllowsAuditedAbsenceWaivers() {
        CourseOffering offering = activeOfferingFor(student);
        LocalDate start = LocalDate.now().minusDays(10);
        AttendanceRecord present = attendance(completedSession(offering, start), AttendanceStatus.PRESENT);
        AttendanceRecord absent = attendance(completedSession(offering, start.plusDays(1)), AttendanceStatus.ABSENT);
        completedSession(offering, start.plusDays(2));

        CreateInvoiceRequest request = new CreateInvoiceRequest(
                List.of(student.getId()),
                "Ten-class package",
                "Attendance-linked lesson package.",
                LocalDate.now().plusDays(30),
                List.of(new LineItemRequest("10 classes", LineItemType.CHARGE, new BigDecimal("1000.00"))),
                new LearningEntitlementRequest(
                        offering.getId(), CoursePurchaseMode.LESSON_PACKAGE,
                        start, start.plusDays(30), 10,
                        AbsenceBillingPolicy.CONSUME_UNEXCUSED, null
                )
        );

        var created = service.create(admin.getId(), request).invoices().getFirst();
        assertThat(created.sessionPackage().status()).isEqualTo("AWAITING_PAYMENT");
        assertThat(created.sessionPackage().usedSessions()).isZero();
        assertThat(created.sessionPackage().remainingSessions()).isZero();
        assertThat(lessonCreditRepository.findAll())
                .extracting(LessonCredit::getStatus)
                .containsOnly(LessonCreditStatus.PENDING_PAYMENT);

        var paid = checkout(student.getId(), created.id()).invoice();
        assertThat(paid.sessionPackage().usedSessions()).isEqualTo(2);
        assertThat(paid.sessionPackage().remainingSessions()).isEqualTo(8);
        assertThat(paid.sessionPackage().status()).isEqualTo("ACTIVE");
        assertThat(paid.sessionPackage().attendedSessions()).isEqualTo(1);
        assertThat(paid.sessionPackage().chargeableAbsences()).isEqualTo(1);
        assertThat(paid.sessionPackage().unrecordedSessions()).isEqualTo(1);
        assertThat(lessonCreditRepository.findAll()).hasSize(10);
        assertThat(lessonCreditRepository.findAll())
                .extracting(credit -> credit.getStatus())
                .contains(LessonCreditStatus.USED, LessonCreditStatus.COUNTED_ABSENCE, LessonCreditStatus.BOOKED);

        var waived = sessionPackageService.updateAttendanceDecision(
                admin.getId(), created.sessionPackage().id(), absent.getId(),
                new UpdateAttendanceBillingRequest(AttendanceBillingDecision.WAIVE, "Approved medical absence")
        );
        assertThat(waived.usedSessions()).isEqualTo(1);
        assertThat(waived.remainingSessions()).isEqualTo(9);
        assertThat(waived.waivedAbsences()).isEqualTo(1);
        assertThat(lessonCreditRepository.findAll())
                .extracting(credit -> credit.getStatus())
                .contains(LessonCreditStatus.MAKEUP_DUE);
        assertThat(present.getStatus()).isEqualTo(AttendanceStatus.PRESENT);

        var makeupCredit = lessonCreditRepository.findAll().stream()
                .filter(credit -> credit.getStatus() == LessonCreditStatus.MAKEUP_DUE)
                .findFirst()
                .orElseThrow();
        ClassroomSession replacement = scheduledSession(offering, LocalDate.now().plusDays(5));
        var scheduled = lessonCreditService.scheduleMakeup(
                admin.getId(), makeupCredit.getId(), new ScheduleMakeupRequest(replacement.getId())
        );
        assertThat(scheduled.status()).isEqualTo(LessonCreditStatus.MAKEUP_SCHEDULED);
        assertThat(scheduled.originalSessionId()).isEqualTo(absent.getSession().getId());
        assertThat(scheduled.currentSessionId()).isEqualTo(replacement.getId());
        assertThat(scheduled.events())
                .extracting(event -> event.eventType())
                .contains(LessonCreditEventType.CREATED,
                        LessonCreditEventType.MAKEUP_APPROVED,
                        LessonCreditEventType.MAKEUP_SCHEDULED);

        ClassroomSession changedDate = scheduledSession(offering, LocalDate.now().plusDays(6));
        var rescheduled = lessonCreditService.scheduleMakeup(
                admin.getId(), makeupCredit.getId(), new ScheduleMakeupRequest(changedDate.getId())
        );
        assertThat(rescheduled.currentSessionId()).isEqualTo(changedDate.getId());
        assertThat(rescheduled.events())
                .extracting(event -> event.eventType())
                .contains(LessonCreditEventType.MAKEUP_RESCHEDULED);

        var cancelled = lessonCreditService.cancelMakeup(admin.getId(), makeupCredit.getId());
        assertThat(cancelled.status()).isEqualTo(LessonCreditStatus.MAKEUP_DUE);
        assertThat(cancelled.currentSessionId()).isEqualTo(absent.getSession().getId());
        assertThat(cancelled.events())
                .extracting(event -> event.eventType())
                .contains(LessonCreditEventType.MAKEUP_CANCELLED);

        ClassroomSession afterExpiry = scheduledSession(offering, start.plusDays(31));
        assertThat(lessonCreditService.makeupOptions(makeupCredit.getId()))
                .extracting(option -> option.sessionId())
                .doesNotContain(afterExpiry.getId());
        assertThatThrownBy(() -> lessonCreditService.scheduleMakeup(
                admin.getId(), makeupCredit.getId(), new ScheduleMakeupRequest(afterExpiry.getId())
        )).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("expiry date");
    }

    @Test
    void consecutivePurchasesAggregateWithoutCoveringTheSameSessionTwice() {
        CourseOffering offering = activeOfferingFor(student);
        LocalDate start = LocalDate.now().plusDays(1);
        for (int day = 0; day < 30; day++) {
            scheduledSession(offering, start.plusDays(day));
        }

        var first = service.create(admin.getId(), packageRequest(offering, start, 10, "10 lessons"))
                .invoices().getFirst();
        checkout(student.getId(), first.id());
        var second = service.create(admin.getId(), packageRequest(offering, start, 20, "20 lessons"))
                .invoices().getFirst();
        checkout(student.getId(), second.id());

        var credits = lessonCreditRepository.findAll();
        assertThat(credits).hasSize(30);
        assertThat(credits)
                .extracting(credit -> credit.getCurrentSession().getId())
                .doesNotHaveDuplicates();

        var weekly = reconciliationService.weekly(offering.getId(), start, "", false, 0, 20);
        assertThat(weekly.rows()).singleElement().satisfies(row -> {
            assertThat(row.purchasedSessions()).isEqualTo(30);
            assertThat(row.activeSessions()).isEqualTo(30);
            assertThat(row.pendingSessions()).isZero();
            assertThat(row.remainingSessions()).isEqualTo(30);
        });
    }

    @Test
    void fullSessionCannotBeBookedAsMakeup() {
        CourseOffering offering = activeOfferingFor(student);
        LocalDate missedDate = LocalDate.now().minusDays(1);
        AttendanceRecord absence = attendance(completedSession(offering, missedDate), AttendanceStatus.ABSENT);
        ClassroomSession fullSession = scheduledSession(offering, LocalDate.now().plusDays(1));
        fullSession.setRoomEntity(roomWithCapacity(1));
        sessionRepository.save(fullSession);

        var primaryInvoice = service.create(admin.getId(), new CreateInvoiceRequest(
                List.of(student.getId()),
                "Primary package",
                "One lesson.",
                LocalDate.now().plusDays(7),
                List.of(new LineItemRequest("One lesson", LineItemType.CHARGE, new BigDecimal("100.00"))),
                new LearningEntitlementRequest(
                        offering.getId(), CoursePurchaseMode.LESSON_PACKAGE,
                        missedDate, LocalDate.now().plusDays(7), 1,
                        AbsenceBillingPolicy.CONSUME_UNEXCUSED, null
                )
        )).invoices().getFirst();
        checkout(student.getId(), primaryInvoice.id());
        sessionPackageService.updateAttendanceDecision(
                admin.getId(), primaryInvoice.sessionPackage().id(), absence.getId(),
                new UpdateAttendanceBillingRequest(AttendanceBillingDecision.WAIVE, "Approved absence")
        );
        LessonCredit makeupCredit = lessonCreditRepository.findAll().stream()
                .filter(credit -> credit.getStatus() == LessonCreditStatus.MAKEUP_DUE)
                .findFirst()
                .orElseThrow();

        Student second = student("TEST-1002", "Grace");
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(second);
        enrollment.setCourseOffering(offering);
        enrollmentRepository.save(enrollment);
        var secondInvoice = service.create(admin.getId(), new CreateInvoiceRequest(
                List.of(second.getId()),
                "Reserved lesson",
                "One lesson.",
                LocalDate.now().plusDays(7),
                List.of(new LineItemRequest("One lesson", LineItemType.CHARGE, new BigDecimal("100.00"))),
                new LearningEntitlementRequest(
                        offering.getId(), CoursePurchaseMode.LESSON_PACKAGE,
                        fullSession.getDate(), fullSession.getDate(), 1,
                        AbsenceBillingPolicy.CONSUME_UNEXCUSED, null
                )
        )).invoices().getFirst();
        checkout(second.getId(), secondInvoice.id());

        assertThat(lessonCreditService.makeupOptions(makeupCredit.getId()))
                .extracting(option -> option.sessionId())
                .doesNotContain(fullSession.getId());
        assertThatThrownBy(() -> lessonCreditService.scheduleMakeup(
                admin.getId(), makeupCredit.getId(), new ScheduleMakeupRequest(fullSession.getId())
        )).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("full");
    }

    private CreateInvoiceRequest packageRequest(
            CourseOffering offering,
            LocalDate start,
            int lessons,
            String title
    ) {
        return new CreateInvoiceRequest(
                List.of(student.getId()),
                title,
                "Lesson package.",
                LocalDate.now().plusDays(30),
                List.of(new LineItemRequest(title, LineItemType.CHARGE, new BigDecimal(lessons * 100))),
                new LearningEntitlementRequest(
                        offering.getId(), CoursePurchaseMode.LESSON_PACKAGE,
                        start, start.plusDays(60), lessons,
                        AbsenceBillingPolicy.CONSUME_UNEXCUSED, null
                )
        );
    }

    private io.github.huijingmen.softeng789.classroommonitoring.billing.dto.PaymentDtos.CheckoutResponse checkout(
            java.util.UUID studentId,
            java.util.UUID invoiceId
    ) {
        invoicePublicationService.publish(invoiceId);
        return service.checkout(studentId, invoiceId);
    }

    private CreateInvoiceRequest request(List<java.util.UUID> studentIds, LineItemRequest... lineItems) {
        return new CreateInvoiceRequest(
                studentIds,
                "2026 Semester Two fees",
                "Current teaching period.",
                LocalDate.now().plusDays(30),
                List.of(lineItems),
                null
        );
    }

    private CourseOffering activeOfferingFor(Student enrolledStudent) {
        return activeOfferingFor(enrolledStudent, CoursePurchaseMode.LESSON_PACKAGE);
    }

    private CourseOffering activeOfferingFor(Student enrolledStudent, CoursePurchaseMode purchaseMode) {
        return activeOfferingFor(enrolledStudent, purchaseMode, "TEST 101");
    }

    private CourseOffering activeOfferingFor(
            Student enrolledStudent,
            CoursePurchaseMode purchaseMode,
            String courseCode
    ) {
        Course course = new Course();
        course.setCode(courseCode);
        course.setName(courseCode + " Course");
        courseRepository.save(course);
        CourseOffering offering = new CourseOffering();
        offering.setCourse(course);
        offering.setOfferingCode(courseCode.replace(' ', '-') + "-2026");
        offering.setAcademicTerm("2026 Term Four");
        offering.setPurchaseMode(purchaseMode);
        if (purchaseMode == CoursePurchaseMode.LESSON_PACKAGE) {
            offering.setDefaultSessionCount(10);
            offering.setAbsencePolicy(AbsenceBillingPolicy.CONSUME_UNEXCUSED);
        } else if (purchaseMode == CoursePurchaseMode.MEMBERSHIP) {
            offering.setMembershipInterval(MembershipInterval.MONTHLY);
            offering.setSessionsPerPeriod(8);
        } else if (purchaseMode == CoursePurchaseMode.PAY_PER_LESSON) {
            offering.setPayPerLessonTrigger(PayPerLessonTrigger.BOOKING);
        }
        offeringRepository.save(offering);
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setStudent(enrolledStudent);
        enrollment.setCourseOffering(offering);
        enrollmentRepository.save(enrollment);
        return offering;
    }

    private ClassroomSession completedSession(CourseOffering offering, LocalDate date) {
        ClassroomSession session = new ClassroomSession();
        session.setCourse(offering.getCourse().getCode());
        session.setRoom("Test Room");
        session.setCourseOffering(offering);
        session.setDate(date);
        session.setStartTime(Instant.parse("2026-01-01T09:00:00Z"));
        session.setEndTime(Instant.parse("2026-01-01T10:00:00Z"));
        session.setStatus(SessionStatus.COMPLETED);
        return sessionRepository.save(session);
    }

    private ClassroomSession scheduledSession(CourseOffering offering, LocalDate date) {
        ClassroomSession session = new ClassroomSession();
        session.setCourse(offering.getCourse().getCode());
        session.setRoom("Test Room");
        session.setCourseOffering(offering);
        session.setDate(date);
        session.setStartTime(Instant.parse("2026-12-01T09:00:00Z"));
        session.setEndTime(Instant.parse("2026-12-01T10:00:00Z"));
        session.setStatus(SessionStatus.SCHEDULED);
        return sessionRepository.save(session);
    }

    private Room roomWithCapacity(int capacity) {
        Campus campus = new Campus();
        campus.setName("Capacity Campus");
        campusRepository.save(campus);
        Room room = new Room();
        room.setCampus(campus);
        room.setCode("CAP-1");
        room.setName("Capacity Room");
        room.setCapacity(capacity);
        return roomRepository.save(room);
    }

    private AttendanceRecord attendance(ClassroomSession session, AttendanceStatus status) {
        AttendanceRecord record = new AttendanceRecord();
        record.setStudent(student);
        record.setSession(session);
        record.setStatus(status);
        return attendanceRepository.save(record);
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
