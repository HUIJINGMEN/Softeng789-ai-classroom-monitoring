package io.github.huijingmen.softeng789.classroommonitoring.reports;

import static io.github.huijingmen.softeng789.classroommonitoring.auth.BrowserTestSession.browserSession;

import tools.jackson.databind.json.JsonMapper;
import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway;
import io.github.huijingmen.softeng789.classroommonitoring.service.AttendanceService;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:class-report-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
@AutoConfigureMockMvc
class ClassReportServiceTest {
    @Autowired ClassReportService service;
    @Autowired TeacherRepository teachers;
    @Autowired StudentRepository students;
    @Autowired CourseRepository courses;
    @Autowired CourseOfferingRepository offerings;
    @Autowired CourseEnrollmentRepository enrolments;
    @Autowired ClassroomSessionRepository sessions;
    @Autowired AttendanceRecordRepository attendance;
    @Autowired AttendanceService register;
    @Autowired ClassFeedbackRepository classFeedback;
    @Autowired ProgressReportRepository personalFeedback;
    @Autowired BehaviourEventRepository events;
    @Autowired AccomplishmentRepository awards;
    @Autowired ClassReportRepository reports;
    @Autowired SessionAuthService auth;
    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @MockitoBean ReportNarrativeGateway ai;
    @MockitoBean ReportEmailGateway email;
    Teacher teacher;
    Student first;
    Student second;
    CourseOffering offering;
    ClassReportModels.Scope scope;
    LocalDate from = LocalDate.now(ZoneId.of("Pacific/Auckland")).minusDays(10);

    @Test void browsingDraftDoesNotCreateOrUpdateIt() throws Exception {
        long before = reports.count();
        assertThat(service.loadDraft(scope, teacher.getId())).isNull();
        assertThat(reports.count()).isEqualTo(before);
        var prepared = service.prepare(scope, teacher.getId());
        assertThat(service.loadDraft(scope, teacher.getId())).isEqualTo(prepared);
        String token = "Bearer " + auth.issueToken("TEACHER", teacher.getId(), teacher.getName(), teacher.getEmail(), null).token();
        mvc.perform(get("/api/class-reports/draft").with(browserSession(token))
                .param("courseOfferingId", offering.getId().toString()).param("dateFrom", scope.dateFrom().toString())
                .param("dateTo", scope.dateTo().toString())).andExpect(status().isOk());
        assertThat(service.get(prepared.id(), teacher.getId()).version()).isEqualTo(prepared.version());
        assertThat(reports.count()).isEqualTo(before + 1);
    }
    @Test void configuredJackson3ReadsLegacySnapshotsWithoutMissingPrimitiveFailures() throws Exception {
        String stored = "{\"students\":[{\"id\":\"00000000-0000-0000-0000-000000000001\",\"name\":\"Legacy Student\",\"number\":\"LEGACY-1\"}],"
                + "\"sources\":{\"feedback\":[],\"followUps\":[{\"name\":\"Retired personal data\"}]}}";
        var snapshot = json.readValue(stored, ClassReportModels.Snapshot.class);
        assertThat(snapshot.studentCount()).isEqualTo(1);
        assertThat(snapshot.completedSessions()).isZero();
        assertThat(json.writeValueAsString(snapshot)).contains("Legacy Student").doesNotContain("followUps");
    }

    @Test void configuredJackson3PreservesDateTimestampAndExactMoneyJsonShapes() throws Exception {
        var document = json.readTree(json.writeValueAsString(Map.of(
                "date", LocalDate.of(2026, 10, 18), "timestamp", Instant.parse("2026-10-17T11:00:00Z"),
                "amount", new java.math.BigDecimal("10.25"))));
        assertThat(document.get("date").stringValue()).isEqualTo("2026-10-18");
        assertThat(document.get("timestamp").stringValue()).isEqualTo("2026-10-17T11:00:00Z");
        assertThat(document.get("amount").decimalValue()).isEqualByComparingTo("10.25");
    }

    @BeforeEach void setup() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        teacher = new Teacher(); teacher.setStaffNumber(suffix); teacher.setEmail(suffix + "@staff.test"); teacher.setName("Class Reviewer"); teacher.setRole("TEACHER"); teacher = teachers.save(teacher);
        Course course = new Course(); course.setCode(suffix); course.setName("Class test"); course = courses.save(course);
        offering = new CourseOffering(); offering.setCourse(course); offering.setOfferingCode(suffix); offering.setAcademicTerm("Test term"); offering.getTeachers().add(teacher); offering = offerings.save(offering);
        first = student("First", suffix + "1"); second = student("Second", suffix + "2");
        enrol(first, from.minusDays(1), null);
        enrol(second, from.plusDays(1), from.plusDays(2));
        scope = new ClassReportModels.Scope(offering.getId(), from, from.plusDays(15));
        when(ai.generateClass(any(), any())).thenReturn(new Generation("Class feedback summary.", "Evidenced strength.", "Manageable next step.", "QWEN:test"));
    }
    @Test void classMarksRespectHistoricalEnrolmentAndFutureLessonsAreNotMissing() {
        var one = lesson(0, ClassroomSession.SessionStatus.COMPLETED);
        var two = lesson(1, ClassroomSession.SessionStatus.COMPLETED);
        var three = lesson(3, ClassroomSession.SessionStatus.COMPLETED);
        lesson(13, ClassroomSession.SessionStatus.COMPLETED);
        lesson(2, ClassroomSession.SessionStatus.CANCELLED);
        mark(first, one, AttendanceRecord.AttendanceStatus.PRESENT);
        mark(first, two, AttendanceRecord.AttendanceStatus.LATE);
        mark(second, two, AttendanceRecord.AttendanceStatus.ABSENT);
        var report = service.prepare(scope, teacher.getId());
        var snapshot = report.document().snapshot();
        assertThat(snapshot.completedSessions()).isEqualTo(3);
        assertThat(snapshot.attendance()).isEqualTo(new AttendanceSummary(4, 1, 1, 1, 1, 67));
        assertThat(snapshot.studentCount()).isEqualTo(2);
        assertThat(snapshot.students()).hasSize(2);
        assertThat(snapshot.students()).extracting(ClassReportModels.StudentRow::id).containsExactly(first.getId(), second.getId());
        assertThat(snapshot.sessions()).extracting(ClassReportModels.SessionRow::id).containsExactly(one.getId(), two.getId(), three.getId());
        assertThat(report.document().sections()).extracting(Section::topic).containsExactly(Topic.ATTENDANCE, Topic.PAYMENTS, Topic.ABSENCES, Topic.LEARNING);
        assertThat(report.document().sections().get(2).evidence()).anyMatch(text -> text.contains("1 recorded absence"));
    }
    @Test void registerAndReportAgreeAfterEnrolmentEditsAndOnWithdrawalDate() {
        var one = lesson(0, ClassroomSession.SessionStatus.COMPLETED);
        var two = lesson(1, ClassroomSession.SessionStatus.COMPLETED);
        var withdrawalDay = lesson(2, ClassroomSession.SessionStatus.COMPLETED);
        mark(first, one, AttendanceRecord.AttendanceStatus.PRESENT);
        mark(second, two, AttendanceRecord.AttendanceStatus.ABSENT);
        // A later correction to the enrolment date must not hide an existing historical mark.
        var changed = enrolments.findByStudent_IdOrderByCourseOffering_Course_CodeAsc(first.getId()).getFirst();
        changed.setEnrolledAt(from.plusDays(5).atStartOfDay(ZoneId.of("Pacific/Auckland")).toInstant());
        enrolments.save(changed);
        // Historical evidence survives even if no current enrolment can reconstruct that student.
        var historical = student("Historical", UUID.randomUUID().toString());
        mark(historical, withdrawalDay, AttendanceRecord.AttendanceStatus.LATE);
        var pendingStudent = student("Pending", UUID.randomUUID().toString());
        enrol(pendingStudent, from.minusDays(1), null);
        var pending = enrolments.findByStudent_IdOrderByCourseOffering_Course_CodeAsc(pendingStudent.getId()).getFirst();
        pending.setStatus(CourseEnrollment.EnrollmentStatus.PENDING); enrolments.save(pending);

        var snapshot = service.prepare(scope, teacher.getId()).document().snapshot();
        var batch = register.listAttendance(List.of(one.getId(), two.getId(), withdrawalDay.getId()));
        for (var lesson : snapshot.sessions()) {
            var rows = batch.get(lesson.id());
            assertThat(register.listAttendance(lesson.id())).isEqualTo(rows);
            assertThat(rows).noneMatch(row -> row.studentId().equals(pendingStudent.getId()));
            assertThat((long) rows.size()).isEqualTo(lesson.attendance().completed());
            assertThat(rows.stream().filter(row -> row.status() == AttendanceRecord.AttendanceStatus.PRESENT).count())
                    .isEqualTo(lesson.attendance().present());
            assertThat(rows.stream().filter(row -> row.status() == AttendanceRecord.AttendanceStatus.LATE).count())
                    .isEqualTo(lesson.attendance().late());
            assertThat(rows.stream().filter(row -> row.status() == AttendanceRecord.AttendanceStatus.ABSENT).count())
                    .isEqualTo(lesson.attendance().absent());
        }
        assertThat(snapshot.attendance()).isEqualTo(new AttendanceSummary(4, 1, 1, 1, 1, 67));
        assertThat(batch.get(withdrawalDay.getId())).hasSize(2);
        // Read consistency must not authorize writing to a withdrawn enrolment.
        assertThatThrownBy(() -> register.updateAttendance(withdrawalDay.getId(), second.getId(),
                new io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateAttendanceRequest(
                        AttendanceRecord.AttendanceStatus.PRESENT))).hasMessageContaining("not enrolled");
    }
    @Test void classSummaryUsesOnlyClassWideFeedbackAndInferenceIsOutsideTransaction() {
        var note = new ClassFeedback(); note.setCourseOffering(offering); note.setTeacher(teacher); note.setComment("Class worked carefully in today's activity."); classFeedback.save(note);
        var personal = new ProgressReport(); personal.setStudent(first); personal.setTeacher(teacher); personal.setCourseOffering(offering); personal.setComment("PRIVATE INDIVIDUAL NOTE"); personalFeedback.save(personal);
        var prepared = service.prepare(scope, teacher.getId());
        assertThat(prepared.document().snapshot().feedbackCount()).isEqualTo(1);
        assertThat(prepared.document().snapshot().sources().feedback()).hasSize(1);
        assertThat(prepared.document().snapshot().sources().feedback().getFirst().excerpt()).contains("Class worked carefully");
        assertThat(prepared.document().snapshot().sources().toString()).doesNotContain("PRIVATE INDIVIDUAL");
        assertThat(prepared.document().sections().get(3).evidence()).anyMatch(text -> text.contains("Class worked carefully"))
                .noneMatch(text -> text.contains("PRIVATE INDIVIDUAL"));
        when(ai.generateClass(any(), any())).thenAnswer(invocation -> {
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return new Generation("Class feedback summary.", "Strength.", "Next step.", "QWEN:test");
        });
        var generated = service.generate(prepared.id(), Topic.LEARNING, prepared.version(), teacher.getId());
        assertThat(generated.document().sections().get(3).text()).contains("Strengths\nStrength.", "Next steps\nNext step.");
        verify(ai, never()).generate(any(), any());
    }
    @Test void deactivationDuringInferenceCannotChangeTheSavedClassDraft() {
        var note = new ClassFeedback(); note.setCourseOffering(offering); note.setTeacher(teacher);
        note.setComment("Recorded class feedback."); classFeedback.save(note);
        var prepared = service.prepare(scope, teacher.getId());
        String original = reports.findById(prepared.id()).orElseThrow().getDocument();
        when(ai.generateClass(any(), any())).thenAnswer(invocation -> {
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            var caller = teachers.findById(teacher.getId()).orElseThrow();
            caller.setStatus("DEACTIVATED"); teachers.saveAndFlush(caller);
            return new Generation("Must not be saved.", "Strength.", "Next step.", "QWEN:test");
        });
        assertThatThrownBy(() -> service.generate(prepared.id(), Topic.LEARNING, prepared.version(), teacher.getId()))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(org.springframework.http.HttpStatus.FORBIDDEN));
        var stored = reports.findById(prepared.id()).orElseThrow();
        assertThat(stored.getDocument()).isEqualTo(original);
        assertThat(stored.getVersion()).isEqualTo(prepared.version());
        assertThat(stored.getFinalizedAt()).isNull();
        verifyNoInteractions(email);
    }

    @Test void factsAndMissingFeedbackDoNotRequireAiAndZeroDataIsNotPerfectAttendance() {
        var report = service.prepare(scope, teacher.getId());
        assertThat(report.document().snapshot().attendance().rate()).isNull();
        for (var section : report.document().sections()) report = service.generate(report.id(), section.topic(), report.version(), teacher.getId());
        assertThat(report.document().sections()).allMatch(row -> row.provider().equals("RECORDS"));
        assertThat(report.document().sections().get(3).text()).contains("No class-wide teacher feedback");
        assertThat(report.document().sections().get(1).text()).contains("does not imply no fees");
        verifyNoInteractions(ai, email);
    }
    @Test void changedSourcePreservesManualTextAndRequiresExplicitReviewBeforeFinalizing() {
        var one = lesson(0, ClassroomSession.SessionStatus.COMPLETED);
        var report = service.prepare(scope, teacher.getId());
        report = service.save(report.id(), Topic.ATTENDANCE, new Edit(report.version(), "My approved wording", true), teacher.getId());
        mark(first, one, AttendanceRecord.AttendanceStatus.PRESENT);
        var changed = service.prepare(scope, teacher.getId());
        assertThat(changed.id()).isEqualTo(report.id());
        assertThat(changed.document().sections().getFirst()).matches(row -> row.stale() && !row.reviewed() && row.text().equals("My approved wording"));
        assertThatThrownBy(() -> service.save(changed.id(), Topic.ATTENDANCE, new Edit(changed.version(), "Manual review", true), teacher.getId())).isInstanceOf(ResponseStatusException.class).hasMessageContaining("updated source records");
        var acknowledged = service.save(changed.id(), Topic.ATTENDANCE, new Edit(changed.version(), "Manual review", true, true), teacher.getId());
        assertThat(acknowledged.document().sections().getFirst().stale()).isFalse();
        assertThatThrownBy(() -> service.finalizeReport(acknowledged.id(), acknowledged.version(), teacher.getId())).isInstanceOf(ResponseStatusException.class).hasMessageContaining("Review every");
    }
    @Test void redistributingMarksBetweenStudentsRequiresRosterReview() throws Exception {
        var lesson = lesson(1, ClassroomSession.SessionStatus.COMPLETED);
        mark(first, lesson, AttendanceRecord.AttendanceStatus.PRESENT);
        mark(second, lesson, AttendanceRecord.AttendanceStatus.ABSENT);
        var prepared = service.prepare(scope, teacher.getId());
        var approved = service.save(prepared.id(), Topic.ATTENDANCE, new Edit(prepared.version(), "Checked", true), teacher.getId());
        var unchanged = service.prepare(scope, teacher.getId());
        assertThat(unchanged.document().sections().getFirst().reviewed()).isTrue();
        for (var record : attendance.findBySession_IdIn(List.of(lesson.getId()))) {
            record.setStatus(record.getStudent().getId().equals(first.getId())
                    ? AttendanceRecord.AttendanceStatus.ABSENT : AttendanceRecord.AttendanceStatus.PRESENT);
            attendance.save(record);
        }
        var refreshed = service.prepare(scope, teacher.getId());
        assertThat(refreshed.id()).isEqualTo(approved.id());
        assertThat(refreshed.document().snapshot().attendance()).isEqualTo(prepared.document().snapshot().attendance());
        assertThat(refreshed.document().sections().getFirst()).matches(row -> row.stale() && !row.reviewed() && row.text().equals("Checked"));
        assertThat(json.writeValueAsString(refreshed)).contains(first.getId().toString(), second.getId().toString(),
                first.getFullName(), second.getFullName(), first.getStudentNumber(), second.getStudentNumber());
    }
    @Test void finalizedDocumentsAreFrozenAndHistoryDoesNotReadLiveFacts() {
        var prepared = service.prepare(scope, teacher.getId());
        var reviewed = prepared;
        for (var section : prepared.document().sections()) reviewed = service.save(reviewed.id(), section.topic(), new Edit(reviewed.version(), "Approved " + section.title(), true), teacher.getId());
        var finalized = service.finalizeReport(reviewed.id(), reviewed.version(), teacher.getId());
        assertThat(finalized.finalizedAt()).isNotNull();
        assertThat(service.finalizeReport(reviewed.id(), reviewed.version(), teacher.getId())).isEqualTo(finalized);
        lesson(0, ClassroomSession.SessionStatus.COMPLETED);
        assertThat(service.get(finalized.id(), teacher.getId()).document()).isEqualTo(finalized.document());
        assertThat(service.history(offering.getId(), teacher.getId())).extracting(ClassReportModels.View::id).containsExactly(finalized.id());
        assertThatThrownBy(() -> service.save(finalized.id(), Topic.ATTENDANCE, new Edit(finalized.version(), "Change", true), teacher.getId())).hasMessageContaining("frozen");
        assertThat(service.prepare(scope, teacher.getId()).id()).isNotEqualTo(finalized.id());
        verifyNoInteractions(email);
    }
    @Test void versionsAndCourseAccessAreEnforcedAndStudentsCannotReadFinancialReport() throws Exception {
        var report = service.prepare(scope, teacher.getId());
        assertThatThrownBy(() -> service.generate(report.id(), Topic.ATTENDANCE, report.version() + 1, teacher.getId())).hasMessageContaining("another window");
        String studentToken = "Bearer " + auth.issueToken("STUDENT", first.getId(), first.getFullName(), first.getUniversityEmail(), "APPROVED").token();
        for (String path : List.of("/api/class-reports/" + report.id(), "/api/class-reports/history/" + offering.getId())) mvc.perform(get(path).with(browserSession(studentToken))).andExpect(status().isForbidden());
        mvc.perform(post("/api/class-reports/prepare").with(browserSession(studentToken)).contentType("application/json").content(json.writeValueAsString(scope))).andExpect(status().isForbidden());
        String token = "Bearer " + auth.issueToken("TEACHER", teacher.getId(), teacher.getName(), teacher.getEmail(), null).token();
        mvc.perform(post("/api/class-reports/prepare").with(browserSession(token)).contentType("application/json").content("{}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/class-reports/" + report.id() + "/finalize").with(browserSession(token)).contentType("application/json").content("{}")).andExpect(status().isBadRequest());
        Teacher outsider = new Teacher(); String suffix = UUID.randomUUID().toString(); outsider.setName("Other"); outsider.setStaffNumber(suffix); outsider.setEmail(suffix + "@staff.test"); outsider.setRole("TEACHER"); outsider = teachers.save(outsider);
        UUID other = outsider.getId();
        assertThatThrownBy(() -> service.get(report.id(), other)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
    }
    @Test void onlyReviewedObservationsAreIncludedAndPersonalAchievementsStayOutOfClassReports() {
        var one = lesson(0, ClassroomSession.SessionStatus.COMPLETED);
        for (var status : BehaviourEvent.ReviewStatus.values()) {
            var event = new BehaviourEvent(); event.setSession(one); event.setEventType("Discussion"); event.setReviewStatus(status); event.setTimestamp(one.getStartTime()); event.setExternalEventId(UUID.randomUUID().toString()); event.setTrackId("test"); event.setModelVersion("test"); event.setConfidence(new java.math.BigDecimal("0.9")); events.save(event);
        }
        var award = new Accomplishment(); award.setStudent(first); award.setCourseOffering(offering); award.setCreatedByTeacher(teacher); award.setCategory(Accomplishment.Category.AWARD); award.setTitle("Individual award"); award.setAchievementDate(from); award.setStatus(Accomplishment.Status.CONFIRMED); award.setIncludeInReport(true); award = awards.save(award);
        var report = service.prepare(scope, teacher.getId());
        assertThat(report.document().snapshot().confirmedEvents()).containsExactly(new EventCount("Discussion", 2));
        assertThat(report.document().sections()).extracting(Section::topic).containsExactly(Topic.ATTENDANCE, Topic.PAYMENTS, Topic.ABSENCES, Topic.LEARNING);
        assertThat(awards.findById(award.getId())).isPresent();
        assertThatThrownBy(() -> service.generate(report.id(), Topic.ACHIEVEMENTS, report.version(), teacher.getId())).hasMessageContaining("no such section");
    }
    @Test void legacyDraftsAndFinalizedReportsOmitRetiredSectionsWithoutRewritingSavedHistory() throws Exception {
        var report = service.prepare(scope, teacher.getId());
        var stored = reports.findById(report.id()).orElseThrow();
        var document = json.valueToTree(report.document());
        ((tools.jackson.databind.node.ArrayNode) document.get("sections")).add(json.valueToTree(new Section(
                Topic.ACHIEVEMENTS, "Class achievements", List.of("Personal award"), "legacy", "Retired award text", "MANUAL", true, false, "Award reviewer", Instant.now())));
        String original = json.writeValueAsString(document);
        stored.setDocument(original);
        stored = reports.saveAndFlush(stored);
        assertThat(service.get(report.id(), teacher.getId()).document().sections()).extracting(Section::topic).doesNotContain(Topic.ACHIEVEMENTS);
        stored.setFinalizedAt(Instant.now()); reports.saveAndFlush(stored);
        assertThat(service.history(offering.getId(), teacher.getId()).getFirst().document().sections()).hasSize(4);
        assertThat(reports.findById(report.id()).orElseThrow().getDocument()).isEqualTo(original);
    }
    private Student student(String name, String suffix) {
        var row = new Student(); row.setFirstName(name); row.setLastName("Student"); row.setStudentNumber(suffix); row.setUniversityEmail(suffix + "@test.local"); row.setSeat("A1"); row.setCourse("Class"); row.setProgramme("Engineering"); return students.save(row);
    }
    private void enrol(Student student, LocalDate joined, LocalDate withdrawn) {
        var row = new CourseEnrollment(); row.setStudent(student); row.setCourseOffering(offering); row.setEnrolledAt(joined.atStartOfDay(ZoneId.of("Pacific/Auckland")).toInstant());
        if (withdrawn != null) { row.setWithdrawnAt(withdrawn.atStartOfDay(ZoneId.of("Pacific/Auckland")).toInstant()); row.setStatus(CourseEnrollment.EnrollmentStatus.WITHDRAWN); }
        enrolments.save(row);
    }
    private ClassroomSession lesson(int offset, ClassroomSession.SessionStatus status) {
        var row = new ClassroomSession(); row.setCourse("Class"); row.setCourseOffering(offering); row.setTeacher(teacher); row.setRoom("Room 1"); row.setDate(from.plusDays(offset)); row.setStartTime(row.getDate().atTime(10, 0).atZone(ZoneId.of("Pacific/Auckland")).toInstant()); row.setEndTime(row.getStartTime().plusSeconds(3600)); row.setStatus(status); return sessions.save(row);
    }
    private void mark(Student student, ClassroomSession lesson, AttendanceRecord.AttendanceStatus status) {
        var row = new AttendanceRecord(); row.setStudent(student); row.setSession(lesson); row.setStatus(status); attendance.save(row);
    }
}
