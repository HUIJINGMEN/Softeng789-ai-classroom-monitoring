package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.*;
import io.github.huijingmen.softeng789.classroommonitoring.billing.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:admin-assistant-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop"})
@ActiveProfiles("postgres")
@AutoConfigureMockMvc
class AdminAssistantTest {
    @Autowired List<AssistantTool> registeredTools;
    @Autowired AdminAssistantService assistant;
    @Autowired SessionAuthService auth;
    @Autowired StudentRepository students;
    @Autowired TeacherRepository teachers;
    @Autowired CourseRepository courses;
    @Autowired CourseOfferingRepository offerings;
    @Autowired CourseEnrollmentRepository enrolments;
    @Autowired ClassroomSessionRepository sessions;
    @Autowired AttendanceRecordRepository attendance;
    @Autowired StudentInvoiceRepository invoices;
    @Autowired ManualPaymentSubmissionRepository submissions;
    @Autowired ObjectMapper json;
    @Autowired MockMvc mvc;
    @MockBean AssistantPlannerGateway planner;
    private final ZoneId zone = ZoneId.of("Pacific/Auckland");
    private final LocalDate today = LocalDate.now(zone);
    private Student student;
    private Teacher admin;
    private CourseOffering offering;
    private String authorization;
    private String suffix;

    @BeforeEach void setup() {
        suffix = UUID.randomUUID().toString().substring(0,8);
        admin = new Teacher(); admin.setStaffNumber(suffix); admin.setEmail(suffix+"@staff.test"); admin.setName("Assistant Admin"); admin.setRole("ADMIN"); admin = teachers.save(admin);
        student = student("Sam", suffix, "S-" + suffix);
        var course = new Course(); course.setCode("TEST-" + suffix); course.setName("Assistant test"); course = courses.save(course);
        offering = new CourseOffering(); offering.setCourse(course); offering.setOfferingCode(suffix); offering.setAcademicTerm("2026"); offering.getTeachers().add(admin); offering = offerings.save(offering);
        var enrolment = new CourseEnrollment(); enrolment.setStudent(student); enrolment.setCourseOffering(offering); enrolment.setEnrolledAt(today.minusDays(60).atStartOfDay(zone).toInstant()); enrolments.save(enrolment);
        authorization = "Bearer " + auth.issueToken("ADMIN", admin.getId(), admin.getName(), admin.getEmail(), "APPROVED").token();
    }
    @Test void registeredReadToolsDoNotInjectBillingMutationServices() {
        assertThat(registeredTools).isNotEmpty();
        for (AssistantTool tool : registeredTools) {
            assertThat(tool.intents()).isNotEmpty().doesNotContain(Intent.UNSUPPORTED);
            for (var field : tool.getClass().getDeclaredFields()) {
                assertThat(field.getType().getPackageName())
                        .as("%s.%s must remain a read-side dependency", tool.getClass().getSimpleName(), field.getName())
                        .doesNotStartWith("io.github.huijingmen.softeng789.classroommonitoring.billing.service");
            }
        }
    }

    @Test void authenticationAndRoleAreCheckedBeforeInference() throws Exception {
        mvc.perform(post("/api/admin/assistant/ask").contentType("application/json").content("{\"message\":\"today?\"}")).andExpect(status().isUnauthorized());
        String teacher = "Bearer " + auth.issueToken("TEACHER", admin.getId(), "Teacher", admin.getEmail(), "APPROVED").token();
        mvc.perform(post("/api/admin/assistant/ask").header("Authorization",teacher).contentType("application/json").content("{\"message\":\"today?\"}")).andExpect(status().isForbidden());
        String learner = "Bearer " + auth.issueToken("STUDENT", student.getId(), "Student", "s@test", "APPROVED").token();
        mvc.perform(post("/api/admin/assistant/ask").header("Authorization",learner).contentType("application/json").content("{\"message\":\"today?\"}")).andExpect(status().isForbidden());
        verifyNoInteractions(planner);
    }
    @Test void validatesInputBeforeCallingModel() throws Exception {
        mvc.perform(post("/api/admin/assistant/ask").header("Authorization", authorization).contentType("application/json")
                .content(json.writeValueAsString(new Question(" ",List.of(),null,null)))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/assistant/ask").header("Authorization", authorization).contentType("application/json")
                .content(json.writeValueAsString(new Question("x".repeat(1001),List.of(),null,null)))).andExpect(status().isBadRequest());
        verifyNoInteractions(planner);
    }
    @Test void studentCountReadsAllUniqueApprovedRecordsWithoutInferenceOrPreviousScope() {
        var withdrawn = student("Withdrawn", suffix, "W-" + suffix);
        withdrawn.setStatus("WITHDRAWN"); students.save(withdrawn);
        var pending = student("Pending", suffix, "P-" + suffix);
        pending.setApprovalStatus("PENDING"); students.save(pending);
        var rejected = student("Rejected", suffix, "R-" + suffix);
        rejected.setApprovalStatus("REJECTED"); students.save(rejected);
        var all = students.findAll();
        long approved = all.stream().filter(row -> "APPROVED".equals(row.getApprovalStatus())).count();
        long active = all.stream().filter(row -> "APPROVED".equals(row.getApprovalStatus()) && "ACTIVE".equals(row.getStatus())).count();
        long left = all.stream().filter(row -> "APPROVED".equals(row.getApprovalStatus()) && "WITHDRAWN".equals(row.getStatus())).count();
        long awaiting = all.stream().filter(row -> "PENDING".equals(row.getApprovalStatus())).count();
        var context = new Context(Intent.ATTENDANCE, student.getId(), student.getFullName(), today.minusDays(5), today.minusDays(5), "OLD COURSE");
        var answer = assistant.ask(new Question("how many students do we have", List.of("Did Sam attend?"), context, student.getId()), authorization);
        assertThat(answer.status()).isEqualTo("ANSWER"); assertThat(answer.intent()).isEqualTo(Intent.STUDENT_COUNT);
        assertThat(answer.message()).contains("%s approved students: %s active and %s withdrawn".formatted(approved, active, left),
                "Another %s registrations are pending".formatted(awaiting), "counted once", "not a historical headcount");
        assertThat(answer.provider()).isEqualTo("SOURCE_RECORDS"); assertThat(answer.rows()).isEmpty();
        assertThat(answer.context().studentId()).isNull(); assertThat(answer.context().courseQuery()).isEmpty();
        assertThat(answer.dateFrom()).isEqualTo(today); assertThat(answer.dateTo()).isEqualTo(today);
        verifyNoInteractions(planner);
        assertThat(students.findById(pending.getId()).orElseThrow().getApprovalStatus()).isEqualTo("PENDING");
    }
    @Test void modelRoutedStudentCountSupportsParaphrasesButRejectsHistoricalAndCourseFilters() {
        when(planner.plan(any())).thenReturn(plan(Intent.STUDENT_COUNT, "", today, today));
        assertThat(assistant.ask(new Question("What is our student headcount?", List.of(), null, null), authorization).message())
                .contains("approved students", "pending approval");
        when(planner.plan(any())).thenReturn(plan(Intent.STUDENT_COUNT, "", today.minusDays(1), today.minusDays(1)));
        assertThat(ask().message()).contains("not individual students, courses or historical dates");
        when(planner.plan(any())).thenReturn(new Plan(Intent.STUDENT_COUNT, "", "TEST", today, today, false, "en", "QWEN:test"));
        assertThat(ask().message()).contains("not individual students, courses or historical dates");
    }
    @Test void attendanceSeparatesUnknownCancelledAndUpcomingFromAbsence() {
        var present = lesson(-1,9,ClassroomSession.SessionStatus.COMPLETED); mark(present, AttendanceRecord.AttendanceStatus.PRESENT);
        lesson(-1,10,ClassroomSession.SessionStatus.COMPLETED);
        var cancelled = lesson(-1,11,ClassroomSession.SessionStatus.CANCELLED); mark(cancelled,AttendanceRecord.AttendanceStatus.ABSENT);
        var future = lesson(1,10,ClassroomSession.SessionStatus.SCHEDULED); mark(future, AttendanceRecord.AttendanceStatus.PRESENT);
        when(planner.plan(any())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            var request = (PlannerRequest) invocation.getArgument(0); assertThat(request.today()).isEqualTo(today);
            return plan(Intent.ATTENDANCE, student.getStudentNumber(), today.minusDays(1), today.plusDays(1));
        });
        var answer = ask();
        assertThat(answer.rows()).extracting(AnswerRow::status).containsExactly("PRESENT","NOT_RECORDED","CANCELLED","SCHEDULED");
        assertThat(answer.message()).contains("0 absent", "1 not recorded");
        assertThat(answer.rows()).allMatch(row -> row.source().type() == SourceType.SESSION);
    }
    @Test void noLessonsIsNotAnAbsenceAndPendingEnrolmentIsNotScheduledAccess() {
        when(planner.plan(any())).thenReturn(plan(Intent.ATTENDANCE, student.getStudentNumber(), today, today));
        assertThat(ask().message()).contains("not an absence");
        lesson(0,10,ClassroomSession.SessionStatus.SCHEDULED);
        var enrolment = enrolments.findByStudent_IdAndCourseOffering_Id(student.getId(),offering.getId()).orElseThrow();
        enrolment.setStatus(CourseEnrollment.EnrollmentStatus.PENDING); enrolments.save(enrolment);
        assertThat(ask().rows()).isEmpty();
    }
    @Test void sameNameRequiresSelectionAndNeverDefaultsToFirstStudent() {
        var second = student("Sam",suffix,"SECOND-"+suffix);
        when(planner.plan(any())).thenReturn(plan(Intent.ATTENDANCE,student.getFullName(),today,today));
        var answer = ask(); assertThat(answer.status()).isEqualTo("CLARIFY"); assertThat(answer.rows()).isEmpty();
        assertThat(answer.choices()).extracting(Choice::id).containsExactlyInAnyOrder(student.getId(),second.getId());
        var selected = assistant.ask(new Question("Did Sam attend?",List.of(),null,second.getId()),authorization);
        assertThat(selected.context().studentId()).isEqualTo(second.getId());
        assertThatThrownBy(() -> assistant.ask(new Question("Did Sam attend?",List.of(),null,UUID.randomUUID()),authorization)).hasMessageContaining("does not match");
    }
    @Test void literalLookupDoesNotTreatSqlWildcardsAsStudentNames() {
        when(planner.plan(any())).thenReturn(plan(Intent.ATTENDANCE,"%",today,today));
        assertThat(ask().choices()).isEmpty(); assertThat(ask().status()).isEqualTo("CLARIFY");
    }
    @Test void contextualFollowUpRetainsOnlyTheExplicitlySelectedStudent() {
        lesson(-1,10,ClassroomSession.SessionStatus.COMPLETED);
        var plan = new Plan(Intent.ATTENDANCE,"",offering.getCourse().getCode(),today.minusDays(1),today.minusDays(1),true,"zh","QWEN:test");
        when(planner.plan(any())).thenReturn(plan);
        var context = new Context(Intent.ATTENDANCE,student.getId(),student.getFullName(),today,today,"");
        var answer = assistant.ask(new Question("那他昨天呢？",List.of("今天来了吗"),context,null),authorization);
        assertThat(answer.context().studentId()).isEqualTo(student.getId()); assertThat(answer.rows()).hasSize(1);
        assertThat(answer.language()).isEqualTo("zh");
    }
    @Test void globalAbsencesCountPeopleAndMissingMarksSeparately() {
        mark(lesson(-1,9,ClassroomSession.SessionStatus.COMPLETED),AttendanceRecord.AttendanceStatus.ABSENT);
        lesson(-1,10,ClassroomSession.SessionStatus.COMPLETED);
        mark(lesson(-1,11,ClassroomSession.SessionStatus.CANCELLED),AttendanceRecord.AttendanceStatus.ABSENT);
        when(planner.plan(any())).thenReturn(plan(Intent.ABSENCES,"",today.minusDays(1),today));
        var answer = ask(); assertThat(answer.rows()).hasSize(1);
        assertThat(answer.message()).contains("1 distinct students", "1 recorded absence", "1 completed-lesson marks");
    }
    @Test void schedulePreservesCourseDateTeacherRoomAndCancellation() {
        lesson(1,10,ClassroomSession.SessionStatus.CANCELLED);
        when(planner.plan(any())).thenReturn(plan(Intent.SCHEDULE,"",today.plusDays(1),today.plusDays(1)));
        var row = ask().rows().getFirst(); assertThat(row.status()).isEqualTo("CANCELLED");
        assertThat(row.title()).contains(offering.getCourse().getCode()); assertThat(row.subtitle()).contains(today.plusDays(1).toString(),"10:00");
        assertThat(row.facts()).contains(new Fact("Room","Room 1"),new Fact("Teacher",admin.getName()));
    }
    @Test void paymentsReadIssuedInvoicesWithoutChangingStatusesOrConfirmingSubmissions() {
        var invoice = invoice(InvoiceStatus.PARTIALLY_PAID,"NZD"); invoice(InvoiceStatus.DRAFT,"USD"); invoice(InvoiceStatus.CANCELLED,"NZD");
        var pending = new ManualPaymentSubmission(); pending.setInvoice(invoice); pending.setAmount(new BigDecimal("30")); pending.setMethod(ManualPaymentMethod.BANK_TRANSFER);
        pending.setOriginalFileName("private.png"); pending.setContentType("image/png"); pending.setFileSize(100); pending.setStudentNote("PRIVATE NOTE"); submissions.save(pending);
        when(planner.plan(any())).thenReturn(plan(Intent.PAYMENTS,student.getStudentNumber(),today,today));
        var answer = ask(); assertThat(answer.rows()).hasSize(1);
        assertThat(answer.rows().getFirst().facts()).contains(new Fact("Confirmed net receipts","NZD 20.00"),new Fact("Outstanding","NZD 80.00"));
        assertThat(invoices.findById(invoice.getId()).orElseThrow().getStatus()).isEqualTo(InvoiceStatus.PARTIALLY_PAID);
        when(planner.plan(any())).thenReturn(plan(Intent.PAYMENT_REVIEW,student.getStudentNumber(),today,today));
        var review = ask(); assertThat(review.rows().getFirst().status()).isEqualTo("AWAITING_VERIFICATION");
        assertThat(review.toString()).doesNotContain("PRIVATE NOTE","private.png");
        assertThat(submissions.findById(pending.getId()).orElseThrow().getStatus()).isEqualTo(ManualPaymentStatus.PENDING);
    }
    @Test void unsupportedWritesAndOverBroadDatesDoNotExecuteQueries() {
        long count = attendance.count();
        when(planner.plan(any())).thenReturn(plan(Intent.UNSUPPORTED,"",today,today));
        assertThat(ask().status()).isEqualTo("UNSUPPORTED"); assertThat(attendance.count()).isEqualTo(count);
        when(planner.plan(any())).thenReturn(plan(Intent.SCHEDULE,"",today.minusDays(31),today));
        assertThatThrownBy(this::ask).hasMessageContaining("at most 31 days");
    }
    @Test void revokedSessionDuringInferenceCannotReadRecords() {
        when(planner.plan(any())).thenAnswer(invocation -> { auth.logout(authorization.substring(7)); return plan(Intent.SCHEDULE,"",today,today); });
        assertThatThrownBy(this::ask).isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class,
                error -> assertThat(error.getStatusCode()).isEqualTo(org.springframework.http.HttpStatus.UNAUTHORIZED));
    }
    @Test void oneInFlightQuestionPerAdminAndFailuresReleaseTheGuard() {
        when(planner.plan(any())).thenAnswer(invocation -> {
            assertThatThrownBy(this::ask).isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class,
                    error -> assertThat(error.getStatusCode()).isEqualTo(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS));
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE);
        });
        assertThatThrownBy(this::ask).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        doReturn(plan(Intent.SCHEDULE,"",today,today)).when(planner).plan(any());
        assertThat(ask().status()).isEqualTo("ANSWER");
    }
    @Test void financialFiltersCannotSilentlyBecomeCurrentAccountAnswers() {
        invoice(InvoiceStatus.PENDING,"NZD");
        when(planner.plan(any())).thenReturn(plan(Intent.PAYMENTS,student.getStudentNumber(),today.minusDays(1),today.minusDays(1)));
        var dated = ask();
        assertThat(dated.rows()).isEmpty(); assertThat(dated.message()).contains("not course or historical-date filters");
        when(planner.plan(any())).thenReturn(new Plan(Intent.PAYMENTS,student.getStudentNumber(),"TEST",today,today,false,"en","QWEN:test"));
        assertThat(ask().rows()).isEmpty();
    }
    @Test void explicitStudentSearchResumesOriginalDateAndCourseWithoutAnotherInference() throws Exception {
        mark(lesson(-1,9,ClassroomSession.SessionStatus.COMPLETED),AttendanceRecord.AttendanceStatus.PRESENT);
        var context = new Context(Intent.ATTENDANCE,null,"",today.minusDays(1),today.minusDays(1),offering.getCourse().getCode());
        var question = new Question("Did a student attend yesterday?",List.of(),context,null,student.getStudentNumber());
        var response = mvc.perform(post("/api/admin/assistant/ask").header("Authorization",authorization).contentType("application/json")
                .content(json.writeValueAsString(question))).andExpect(status().isOk()).andReturn();
        var answer = json.readValue(response.getResponse().getContentAsString(),Answer.class);
        assertThat(answer.context().studentId()).isEqualTo(student.getId()); assertThat(answer.dateFrom()).isEqualTo(today.minusDays(1));
        assertThat(answer.rows()).hasSize(1); assertThat(answer.provider()).isEqualTo("SOURCE_RECORDS"); verifyNoInteractions(planner);
    }
    @Test void resumedStudentSearchStillRequiresAValidChoiceForDuplicateNames() {
        var second = student("Sam",suffix,"SECOND-"+suffix);
        var context = new Context(Intent.ATTENDANCE,null,"",today,today,"");
        var ambiguous = assistant.ask(new Question("Which student?",List.of(),context,null,student.getFullName()),authorization);
        assertThat(ambiguous.status()).isEqualTo("CLARIFY"); assertThat(ambiguous.choices()).hasSize(2);
        var selected = assistant.ask(new Question("Which student?",List.of(),context,second.getId(),student.getFullName()),authorization);
        assertThat(selected.context().studentId()).isEqualTo(second.getId());
        assertThatThrownBy(() -> assistant.ask(new Question("Which student?",List.of(),context,UUID.randomUUID(),student.getFullName()),authorization)).hasMessageContaining("does not match");
        verifyNoInteractions(planner);
    }
    @Test void invalidOrOverlongClarificationCannotCallTheModelOrBypassScopeLimits() throws Exception {
        var context = new Context(Intent.ATTENDANCE,null,"",today,today,"");
        for (var question : List.of(new Question("Which student?",List.of(),null,null,"Sam"),
                new Question("Which student?",List.of(),context,null," "),
                new Question("Which student?",List.of(),context,null,"x".repeat(121)),
                new Question("Which student?",List.of(),new Context(Intent.UNSUPPORTED,null,"",today,today,""),null,"Sam"),
                new Question("Which student?",List.of(),new Context(Intent.ATTENDANCE,null,"",today.minusDays(31),today,""),null,"Sam"))) {
            mvc.perform(post("/api/admin/assistant/ask").header("Authorization",authorization).contentType("application/json")
                    .content(json.writeValueAsString(question))).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(planner);
    }
    private Answer ask() { return assistant.ask(new Question("Check records",List.of(),null,null),authorization); }
    private Plan plan(Intent intent,String name,LocalDate from,LocalDate to) {
        String course = intent == Intent.PAYMENTS || intent == Intent.PAYMENT_REVIEW || intent == Intent.STUDENT_COUNT ? "" : offering.getCourse().getCode();
        return new Plan(intent,name,course,from,to,false,"en","QWEN:test");
    }
    private Student student(String first,String last,String number) {
        var row = new Student(); row.setFirstName(first); row.setLastName(last); row.setStudentNumber(number); row.setUniversityEmail(number+"@student.test");
        row.setSeat("A1"); row.setCourse("Test"); row.setProgramme("Engineering"); return students.save(row);
    }
    private ClassroomSession lesson(int offset,int hour,ClassroomSession.SessionStatus status) {
        var row = new ClassroomSession(); row.setCourse("Test"); row.setCourseOffering(offering); row.setTeacher(admin); row.setRoom("Room 1"); row.setDate(today.plusDays(offset));
        row.setStartTime(row.getDate().atTime(hour,0).atZone(zone).toInstant()); row.setEndTime(row.getStartTime().plusSeconds(3600)); row.setStatus(status); return sessions.save(row);
    }
    private void mark(ClassroomSession session,AttendanceRecord.AttendanceStatus status) {
        var row = new AttendanceRecord(); row.setStudent(student); row.setSession(session); row.setStatus(status); attendance.save(row);
    }
    private StudentInvoice invoice(InvoiceStatus status,String currency) {
        var row = new StudentInvoice(); row.setStudent(student); row.setCreatedByAdmin(admin); row.setInvoiceNumber(UUID.randomUUID().toString().substring(0,8));
        row.setTitle("Course fee"); row.setCurrency(currency); row.setStatus(status); row.setDueDate(today.minusDays(2));
        var item = new InvoiceLineItem(); item.setDescription("Course fee"); item.setType(LineItemType.CHARGE); item.setAmount(new BigDecimal("100")); row.addLineItem(item);
        var receipt = new PaymentTransaction(); receipt.setAmount(new BigDecimal("20")); receipt.setStatus(PaymentStatus.SUCCEEDED); receipt.setProvider("TEST"); receipt.setProviderReference(UUID.randomUUID().toString()); receipt.setOccurredAt(Instant.now()); row.addTransaction(receipt);
        return invoices.saveAndFlush(row);
    }
}
