package io.github.huijingmen.softeng789.classroommonitoring.reports;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:overall-report-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
@AutoConfigureMockMvc
class OverallReportServiceTest {
    @Autowired OverallReportService service;
    @Autowired TeacherRepository teachers;
    @Autowired StudentRepository students;
    @Autowired CourseRepository courses;
    @Autowired CourseOfferingRepository offerings;
    @Autowired CourseEnrollmentRepository enrolments;
    @Autowired ClassroomSessionRepository sessions;
    @Autowired AttendanceRecordRepository attendance;
    @Autowired ClassFeedbackRepository feedback;
    @Autowired ProgressReportRepository personalFeedback;
    @Autowired SessionAuthService auth;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean ReportNarrativeGateway ai;
    @MockBean ReportEmailGateway email;
    Teacher admin;
    Student student;
    CourseOffering first;
    CourseOffering second;
    LocalDate from = LocalDate.now(ZoneId.of("Pacific/Auckland")).minusDays(10);

    @BeforeEach void setup() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        admin = new Teacher(); admin.setStaffNumber(suffix); admin.setEmail(suffix + "@staff.test");
        admin.setName("Overall Reviewer"); admin.setRole("ADMIN"); admin = teachers.save(admin);
        student = new Student(); student.setFirstName("Private"); student.setLastName("Student");
        student.setStudentNumber(suffix); student.setUniversityEmail(suffix + "@student.test");
        student.setSeat("A1"); student.setCourse("Test"); student.setProgramme("Engineering"); student = students.save(student);
        first = offering(suffix + "1"); second = offering(suffix + "2");
        when(ai.generateOverall(any(), any())).thenReturn(new Generation("Class-wide findings.", "Checked strength.", "Manageable next step.", "QWEN:test"));
    }
    @Test void distinctStudentsAndRatesAreWeightedByRawMarksInsteadOfCoursePercentages() {
        mark(lesson(first, 0, ClassroomSession.SessionStatus.COMPLETED), AttendanceRecord.AttendanceStatus.PRESENT);
        mark(lesson(first, 1, ClassroomSession.SessionStatus.COMPLETED), AttendanceRecord.AttendanceStatus.LATE);
        mark(lesson(second, 0, ClassroomSession.SessionStatus.COMPLETED), AttendanceRecord.AttendanceStatus.ABSENT);
        lesson(second, 1, ClassroomSession.SessionStatus.COMPLETED);
        lesson(second, 13, ClassroomSession.SessionStatus.COMPLETED);
        lesson(second, 2, ClassroomSession.SessionStatus.CANCELLED);
        var report = service.prepare(scope(Audience.INTERNAL), admin.getId());
        var snapshot = report.document().snapshot();
        assertThat(snapshot.studentCount()).isEqualTo(1);
        assertThat(snapshot.courses()).hasSize(2);
        assertThat(snapshot.completedSessions()).isEqualTo(4);
        assertThat(snapshot.attendance()).isEqualTo(new AttendanceSummary(4, 1, 1, 1, 1, 67));
        assertThat(snapshot.attendanceTrend().stream().map(AttendancePoint::attendance).mapToLong(AttendanceSummary::completed).sum()).isEqualTo(4);
        assertThat(snapshot.actions()).extracting(Action::issue).contains("Incomplete attendance", "Recorded absences", "No class feedback");
        assertThat(report.document().sections()).extracting(Section::topic).containsExactly(Topic.OVERVIEW, Topic.ATTENDANCE, Topic.ABSENCES, Topic.LEARNING);
    }
    @Test void partnerAndInternalDraftsAreSeparateAndPartnerProjectionContainsNoPrivateRegistersOrFinance() throws Exception {
        lesson(first, 0, ClassroomSession.SessionStatus.COMPLETED);
        var internal = service.prepare(scope(Audience.INTERNAL), admin.getId());
        var partner = service.prepare(scope(Audience.PARTNER), admin.getId());
        assertThat(partner.id()).isNotEqualTo(internal.id());
        assertThat(partner.document().snapshot().actions()).isEmpty();
        assertThat(partner.document().snapshot().creditDecisions()).isEmpty();
        String serialized = json.writeValueAsString(partner);
        assertThat(serialized).doesNotContain(student.getId().toString(), student.getFullName(), student.getUniversityEmail(), "\"payments\"", "\"invoices\"", "\"balance\"", "\"students\":[");
        assertThat(service.prepare(scope(Audience.INTERNAL), admin.getId()).id()).isEqualTo(internal.id());
    }
    @Test void onlyClassWideFeedbackIsUsedAndInferenceDoesNotHoldADatabaseTransaction() {
        var note = new ClassFeedback(); note.setCourseOffering(first); note.setTeacher(admin);
        note.setComment("Class worked carefully today."); feedback.save(note);
        var personal = new ProgressReport(); personal.setStudent(student); personal.setCourseOffering(first); personal.setTeacher(admin);
        personal.setComment("PRIVATE INDIVIDUAL NOTE"); personalFeedback.save(personal);
        var report = service.prepare(scope(Audience.PARTNER), admin.getId());
        assertThat(report.document().snapshot().feedbackCount()).isEqualTo(1);
        assertThat(report.document().sections().getLast().evidence()).anyMatch(text -> text.contains("Class worked carefully")).noneMatch(text -> text.contains("PRIVATE INDIVIDUAL"));
        when(ai.generateOverall(any(), any())).thenAnswer(invocation -> {
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return new Generation("Findings.", "Strength.", "Next step.", "QWEN:test");
        });
        var generated = service.generate(report.id(), Topic.LEARNING, report.version(), admin.getId());
        assertThat(generated.document().sections().getLast().text()).contains("Strengths\nStrength.", "Next steps\nNext step.");
        verify(ai, never()).generate(any(), any()); verify(ai, never()).generateClass(any(), any()); verifyNoInteractions(email);
    }
    @Test void zeroDataHasNoRateAndAllNumericalDraftsWorkWithoutAi() {
        var report = service.prepare(scope(Audience.INTERNAL), admin.getId());
        assertThat(report.document().snapshot().attendance().rate()).isNull();
        for (var section : report.document().sections()) report = service.generate(report.id(), section.topic(), report.version(), admin.getId());
        assertThat(report.document().sections()).allMatch(section -> section.provider().equals("RECORDS") && !section.reviewed());
        assertThat(report.document().sections().getLast().text()).contains("No class-wide teacher feedback");
        verifyNoInteractions(ai, email);
    }
    @Test void changedSourcePreservesEditsButRequiresFreshReview() {
        var lesson = lesson(first, 0, ClassroomSession.SessionStatus.COMPLETED);
        var prepared = service.prepare(scope(Audience.INTERNAL), admin.getId());
        var edited = service.save(prepared.id(), Topic.ATTENDANCE, new Edit(prepared.version(), "Manual wording", true), admin.getId());
        mark(lesson, AttendanceRecord.AttendanceStatus.PRESENT);
        var refreshed = service.prepare(scope(Audience.INTERNAL), admin.getId());
        assertThat(refreshed.id()).isEqualTo(edited.id());
        assertThat(refreshed.document().sections().get(1)).matches(row -> row.stale() && !row.reviewed() && row.text().equals("Manual wording"));
        assertThatThrownBy(() -> service.save(refreshed.id(), Topic.ATTENDANCE, new Edit(refreshed.version(), "Checked", true), admin.getId())).hasMessageContaining("updated source records");
        var acknowledged = service.save(refreshed.id(), Topic.ATTENDANCE, new Edit(refreshed.version(), "Checked", true, true), admin.getId());
        assertThat(acknowledged.document().sections().get(1).stale()).isFalse();
        assertThatThrownBy(() -> service.generate(refreshed.id(), Topic.OVERVIEW, refreshed.version(), admin.getId())).hasMessageContaining("another window");
    }
    @Test void partnerExportRequiresReviewAndPrivacyAcknowledgementThenFreezesHistory() {
        var prepared = service.prepare(scope(Audience.PARTNER), admin.getId());
        assertThatThrownBy(() -> service.finalizeReport(prepared.id(), new Finalize(prepared.version(), true), admin.getId())).hasMessageContaining("Review every");
        var reviewed = prepared;
        for (var section : prepared.document().sections()) reviewed = service.save(reviewed.id(), section.topic(), new Edit(reviewed.version(), "Approved " + section.title(), true), admin.getId());
        var ready = reviewed;
        assertThatThrownBy(() -> service.finalizeReport(ready.id(), new Finalize(ready.version(), false), admin.getId())).hasMessageContaining("confidential wording");
        var frozen = service.finalizeReport(ready.id(), new Finalize(ready.version(), true), admin.getId());
        assertThat(frozen.privacyReviewedBy()).isEqualTo(admin.getName()); assertThat(frozen.privacyReviewedAt()).isNotNull();
        assertThat(service.finalizeReport(ready.id(), new Finalize(ready.version(), true), admin.getId())).isEqualTo(frozen);
        lesson(first, 0, ClassroomSession.SessionStatus.COMPLETED);
        assertThat(service.get(frozen.id(), admin.getId()).document()).isEqualTo(frozen.document());
        assertThat(service.history(admin.getId())).extracting(OverallReportModels.View::id).contains(frozen.id());
        assertThatThrownBy(() -> service.save(frozen.id(), Topic.OVERVIEW, new Edit(frozen.version(), "Change", true), admin.getId())).hasMessageContaining("frozen");
        assertThat(service.prepare(scope(Audience.PARTNER), admin.getId()).id()).isNotEqualTo(frozen.id());
        verifyNoInteractions(email);
    }
    @Test void institutionEndpointsRejectTeachersAndStudentsAndValidateScope() throws Exception {
        var report = service.prepare(scope(Audience.INTERNAL), admin.getId());
        for (String role : List.of("STUDENT", "TEACHER")) {
            String token = "Bearer " + auth.issueToken(role, student.getId(), "Unprivileged", student.getUniversityEmail(), "APPROVED").token();
            mvc.perform(get("/api/overall-reports/" + report.id()).header("Authorization", token)).andExpect(status().isForbidden());
            mvc.perform(get("/api/overall-reports/history").header("Authorization", token)).andExpect(status().isForbidden());
            mvc.perform(post("/api/overall-reports/prepare").header("Authorization", token).contentType("application/json").content(json.writeValueAsString(scope(Audience.INTERNAL)))).andExpect(status().isForbidden());
        }
        String token = "Bearer " + auth.issueToken("ADMIN", admin.getId(), admin.getName(), admin.getEmail(), null).token();
        mvc.perform(post("/api/overall-reports/prepare").header("Authorization", token).contentType("application/json").content("{}")).andExpect(status().isBadRequest());
        assertThatThrownBy(() -> service.prepare(new OverallReportModels.Scope(from, from.minusDays(1), Audience.INTERNAL, List.of()), admin.getId())).hasMessageContaining("valid reporting period");
        assertThatThrownBy(() -> service.prepare(new OverallReportModels.Scope(from, from.plusDays(367), Audience.INTERNAL, List.of()), admin.getId())).hasMessageContaining("valid reporting period");
        assertThatThrownBy(() -> service.prepare(new OverallReportModels.Scope(from, from.plusDays(1), Audience.INTERNAL, List.of(UUID.randomUUID())), admin.getId())).hasMessageContaining("no longer exists");
    }
    private OverallReportModels.Scope scope(Audience audience) {
        return new OverallReportModels.Scope(from, from.plusDays(15), audience, List.of(first.getId(), second.getId()));
    }
    private CourseOffering offering(String suffix) {
        var course = new Course(); course.setCode(suffix); course.setName("Overall test"); course = courses.save(course);
        var row = new CourseOffering(); row.setCourse(course); row.setOfferingCode(suffix); row.setAcademicTerm("Test term"); row = offerings.save(row);
        var enrol = new CourseEnrollment(); enrol.setStudent(student); enrol.setCourseOffering(row);
        enrol.setEnrolledAt(from.minusDays(1).atStartOfDay(ZoneId.of("Pacific/Auckland")).toInstant()); enrolments.save(enrol);
        return row;
    }
    private ClassroomSession lesson(CourseOffering course, int offset, ClassroomSession.SessionStatus status) {
        var row = new ClassroomSession(); row.setCourse("Overall"); row.setCourseOffering(course); row.setTeacher(admin); row.setRoom("Room 1");
        row.setDate(from.plusDays(offset)); row.setStartTime(row.getDate().atTime(10, 0).atZone(ZoneId.of("Pacific/Auckland")).toInstant());
        row.setEndTime(row.getStartTime().plusSeconds(3600)); row.setStatus(status); return sessions.save(row);
    }
    private void mark(ClassroomSession lesson, AttendanceRecord.AttendanceStatus status) {
        var row = new AttendanceRecord(); row.setStudent(student); row.setSession(lesson); row.setStatus(status); attendance.save(row);
    }
}
