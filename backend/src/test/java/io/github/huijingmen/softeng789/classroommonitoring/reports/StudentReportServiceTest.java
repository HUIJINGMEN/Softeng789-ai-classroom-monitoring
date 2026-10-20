package io.github.huijingmen.softeng789.classroommonitoring.reports;

import static io.github.huijingmen.softeng789.classroommonitoring.auth.BrowserTestSession.browserSession;

import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.service.SessionAuthService;
import io.github.huijingmen.softeng789.classroommonitoring.service.ReportEmailGateway;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequesterRole;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentRequestType;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentSupportRequest;
import io.github.huijingmen.softeng789.classroommonitoring.support.repository.StudentSupportRequestRepository;
import tools.jackson.databind.json.JsonMapper;
import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.test.web.servlet.MockMvc;
import org.mockito.ArgumentCaptor;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:student-report-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
        "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("postgres")
@AutoConfigureMockMvc
class StudentReportServiceTest {
    @Autowired private StudentReportService service;
    @Autowired private StudentReportWorkspace workspace;
    @Autowired private StudentReportRepository savedReports;
    @Autowired private TeacherRepository teachers;
    @Autowired private StudentRepository students;
    @Autowired private CourseRepository courses;
    @Autowired private CourseOfferingRepository offerings;
    @Autowired private CourseEnrollmentRepository enrolments;
    @Autowired private AccomplishmentRepository achievements;
    @Autowired private AccomplishmentFeedbackRepository corrections;
    @Autowired private ClassroomSessionRepository sessions;
    @Autowired private AttendanceRecordRepository attendance;
    @Autowired private BehaviourEventRepository events;
    @Autowired private ProgressReportRepository feedback;
    @Autowired private StudentSupportRequestRepository leaveRequests;
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private SessionAuthService auth;
    @MockitoBean private ReportNarrativeGateway ai;
    @MockitoBean private ReportEmailGateway email;
    private Teacher teacher;
    private Student student;
    private CourseOffering offering;
    private Scope scope;
    @BeforeEach
    void setup() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        teacher = new Teacher(); teacher.setStaffNumber("R-" + suffix); teacher.setEmail(suffix + "@staff.test");
        teacher.setName("Report Reviewer"); teacher.setRole("TEACHER"); teacher = teachers.save(teacher);
        student = new Student(); student.setStudentNumber("R-" + suffix); student.setUniversityEmail(suffix + "@student.test");
        student.setFirstName("Report"); student.setLastName("Student"); student.setCourse("REPORT");
        student.setSeat("A1"); student.setProgramme("Engineering"); student = students.save(student);
        Course course = new Course(); course.setCode("R" + suffix); course.setName("Report Test"); course = courses.save(course);
        offering = new CourseOffering(); offering.setCourse(course); offering.setOfferingCode("R" + suffix);
        offering.setAcademicTerm("2026"); offering.getTeachers().add(teacher); offering = offerings.save(offering);
        CourseEnrollment enrolment = new CourseEnrollment(); enrolment.setStudent(student); enrolment.setCourseOffering(offering);
        enrolment.setEnrolledAt(Instant.parse("2026-01-01T00:00:00Z"));
        enrolments.save(enrolment);
        scope = new Scope(student.getId(), LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31), List.of(offering.getId()));
        when(ai.generate(any(), any())).thenReturn(new Generation("Evidence-based summary.", "Recorded strengths.", "Recorded next steps.", "QWEN:test"));
    }
    @Test void browsingDraftDoesNotCreateOrUpdateIt() throws Exception {
        long before = savedReports.count();
        assertThat(service.loadDraft(scope, teacher.getId())).isNull();
        assertThat(savedReports.count()).isEqualTo(before);
        var prepared = service.prepare(scope, teacher.getId());
        assertThat(service.loadDraft(scope, teacher.getId())).isEqualTo(prepared);
        String token = "Bearer " + auth.issueToken("TEACHER", teacher.getId(), teacher.getName(), teacher.getEmail(), null).token();
        mvc.perform(get("/api/student-reports/draft").with(browserSession(token))
                .param("studentId", student.getId().toString()).param("dateFrom", scope.dateFrom().toString())
                .param("dateTo", scope.dateTo().toString()).param("courseOfferingIds", offering.getId().toString()))
                .andExpect(status().isOk());
        assertThat(service.get(prepared.id(), teacher.getId()).version()).isEqualTo(prepared.version());
        assertThat(savedReports.count()).isEqualTo(before + 1);
    }
    @Test void reportAlwaysHasFourCoreSectionsAndNoEmptyAchievements() {
        var report = service.prepare(scope, teacher.getId());
        assertThat(report.document().sections()).extracting(Section::topic)
                .containsExactly(Topic.ATTENDANCE, Topic.PAYMENTS, Topic.ABSENCES, Topic.LEARNING);
        assertThat(report.document().sections().get(3).evidence()).anyMatch(text -> text.contains("No teacher feedback"));
        assertThat(report.document().sections().getFirst().evidence()).anyMatch(text -> text.contains("Unavailable"));
        assertThat(report.document().snapshot().student().studentNumber()).isEqualTo(student.getStudentNumber());
        assertThat(report.document().snapshot().courses()).hasSize(1);
        assertThat(report.document().snapshot().courses().getFirst().teachers()).containsExactly(teacher.getName());
        assertThat(report.document().snapshot().feedbackCount()).isZero();
        assertThat(report.document().snapshot().attendance().rate()).isNull();
        assertThat(report.document().sections().get(3).text()).isEqualTo("No teacher feedback recorded for the selected courses and dates.");
    }
    @Test void workspaceIsReadOnlyAndExactToDatesAndCourseScope() {
        long before = savedReports.count();
        var request = new StudentReportWorkspace.Request(List.of(scope));
        assertThat(workspace.list(request, teacher.getId()).getFirst().draft()).isNull();
        assertThat(savedReports.count()).isEqualTo(before);
        var report = service.prepare(scope, teacher.getId());
        report = service.save(report.id(), Topic.ATTENDANCE, new Edit(report.version(), "Manual wording.", false), teacher.getId());
        var row = workspace.list(request, teacher.getId()).getFirst();
        assertThat(row.draft().id()).isEqualTo(report.id());
        assertThat(row.draft().reviewed()).isZero();
        assertThat(row.published()).isNull();
        var otherPeriod = new Scope(scope.studentId(), scope.dateFrom().plusDays(1), scope.dateTo(), scope.courseOfferingIds());
        var other = workspace.list(new StudentReportWorkspace.Request(List.of(otherPeriod)), teacher.getId()).getFirst();
        assertThat(other.draft()).isNull();
        assertThat(other.otherDraft().id()).isEqualTo(report.id());
        assertThat(other.otherDraft().dateFrom()).isEqualTo(scope.dateFrom());
        verifyNoInteractions(ai);
    }
    @Test void workspaceSeparatesReviewedDraftFromPublishedVersion() {
        var report = service.prepare(scope, teacher.getId());
        for (var section : report.document().sections())
            report = service.save(report.id(), section.topic(), new Edit(report.version(), "Reviewed wording.", true), teacher.getId());
        var request = new StudentReportWorkspace.Request(List.of(scope));
        var row = workspace.list(request, teacher.getId()).getFirst();
        assertThat(row.draft().reviewed()).isEqualTo(4);
        assertThat(row.published()).isNull();
        service.publish(report.id(), report.version(), teacher.getId());
        row = workspace.list(request, teacher.getId()).getFirst();
        assertThat(row.draft()).isNull();
        assertThat(row.published().publishedAt()).isNotNull();
        service.prepare(scope, teacher.getId());
        row = workspace.list(request, teacher.getId()).getFirst();
        assertThat(row.draft()).isNotNull();
        assertThat(row.published()).isNotNull();
    }
    @Test void workspaceRejectsUnauthorizedScopesAndNeverSharesAnotherTeachersPrivateDraft() {
        service.prepare(scope, teacher.getId());
        var colleague = new Teacher(); colleague.setStaffNumber("W-" + UUID.randomUUID()); colleague.setEmail(UUID.randomUUID() + "@staff.test");
        colleague.setName("Other teacher"); colleague.setRole("TEACHER"); colleague = teachers.save(colleague);
        UUID colleagueId = colleague.getId();
        var request = new StudentReportWorkspace.Request(List.of(scope));
        assertThatThrownBy(() -> workspace.list(request, colleagueId)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
        offering.getTeachers().add(colleague); offerings.save(offering);
        var row = workspace.list(request, colleagueId).getFirst();
        assertThat(row.draft()).isNull();
        assertThat(row.otherDraft()).isNull();
    }
    @Test void workspaceEndpointValidatesBatchAndDoesNotAllowStudentAccess() throws Exception {
        String staffToken = "Bearer " + auth.issueToken("TEACHER", teacher.getId(), teacher.getName(), teacher.getEmail(), null).token();
        mvc.perform(post("/api/student-reports/workspace").with(browserSession(staffToken))
                .contentType("application/json").content("{\"scopes\":[null]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/student-reports/workspace").with(browserSession(staffToken))
                .contentType("application/json").content(json.writeValueAsString(new StudentReportWorkspace.Request(List.of(scope)))))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].studentId").value(student.getId().toString()))
                .andExpect(jsonPath("$[0].draft").isEmpty());
        String studentToken = "Bearer " + auth.issueToken("STUDENT", student.getId(), student.getFullName(), student.getUniversityEmail(), "APPROVED").token();
        mvc.perform(post("/api/student-reports/workspace").with(browserSession(studentToken))
                .contentType("application/json").content(json.writeValueAsString(new StudentReportWorkspace.Request(List.of(scope)))))
                .andExpect(status().isForbidden());
    }
    @Test void emailUsesEveryReviewedNarrativeAndBlocksUnreviewedDrafts() {
        View draft = service.prepare(scope, teacher.getId());
        assertThatThrownBy(() -> service.email(draft.id(), draft.version(), teacher.getId()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Review every");
        verifyNoInteractions(email);
        View reviewed = draft;
        for (Section section : draft.document().sections()) {
            reviewed = service.save(reviewed.id(), section.topic(), new Edit(reviewed.version(), "Final " + section.title(), true), teacher.getId());
        }
        when(email.send(any())).thenReturn(new ReportEmailGateway.DeliveryResult("DEMO", "Test only"));
        assertThat(service.email(reviewed.id(), reviewed.version(), teacher.getId()).status()).isEqualTo("DEMO");
        var captured = ArgumentCaptor.forClass(ReportEmailGateway.EmailMessage.class);
        verify(email).send(captured.capture());
        assertThat(captured.getValue().reportBody()).contains("Final Attendance", "Final Payments", "Final Absences & make-ups", "Final Teacher feedback summary");
        assertThat(captured.getValue().reportBody()).contains(student.getStudentNumber(), "Student course record", "Student attendance");
    }
    @Test void authenticatedApiGeneratesReviewsPublishesAndRestrictsStudentAccess() throws Exception {
        String staffToken = "Bearer " + auth.issueToken("TEACHER", teacher.getId(), teacher.getName(), teacher.getEmail(), null).token();
        var prepared = mvc.perform(post("/api/student-reports/prepare").with(browserSession(staffToken))
                        .contentType("application/json").content(json.writeValueAsString(scope)))
                .andExpect(status().isOk()).andReturn();
        View report = json.readValue(prepared.getResponse().getContentAsString(), View.class);
        for (Section section : report.document().sections()) {
            var generated = mvc.perform(post("/api/student-reports/" + report.id() + "/sections/" + section.topic() + "/generate")
                            .with(browserSession(staffToken)).contentType("application/json")
                            .content(json.writeValueAsString(new Revision(report.version()))))
                    .andExpect(status().isOk()).andReturn();
            report = json.readValue(generated.getResponse().getContentAsString(), View.class);
            var approved = mvc.perform(put("/api/student-reports/" + report.id() + "/sections/" + section.topic())
                            .with(browserSession(staffToken)).contentType("application/json")
                            .content(json.writeValueAsString(new Edit(report.version(), "Approved " + section.title(), true))))
                    .andExpect(status().isOk()).andReturn();
            report = json.readValue(approved.getResponse().getContentAsString(), View.class);
        }
        mvc.perform(post("/api/student-reports/" + report.id() + "/publish").with(browserSession(staffToken))
                        .contentType("application/json").content(json.writeValueAsString(new Revision(report.version()))))
                .andExpect(status().isOk());
        String studentToken = "Bearer " + auth.issueToken("STUDENT", student.getId(), student.getFullName(), student.getUniversityEmail(), "APPROVED").token();
        mvc.perform(get("/api/students/" + student.getId() + "/reports").with(browserSession(studentToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].document.sections.length()").value(4))
                .andExpect(jsonPath("$[0].document.sections[3].text").value("Approved Teacher feedback summary"));
        mvc.perform(get("/api/students/" + UUID.randomUUID() + "/reports").with(browserSession(studentToken)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/student-reports/prepare").with(browserSession(studentToken))
                        .contentType("application/json").content(json.writeValueAsString(scope)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/student-reports/prepare").with(browserSession(staffToken))
                        .contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
    }
    @Test void unknownMarksAreNotAbsencesAndFutureOrCancelledLessonsAreExcluded() {
        var present = lesson(ClassroomSession.SessionStatus.COMPLETED, 1);
        lesson(ClassroomSession.SessionStatus.COMPLETED, 2);
        var unknown = lesson(ClassroomSession.SessionStatus.COMPLETED, 3);
        var scheduled = lesson(ClassroomSession.SessionStatus.SCHEDULED, 4);
        mark(scheduled, AttendanceRecord.AttendanceStatus.ABSENT);
        lesson(ClassroomSession.SessionStatus.CANCELLED, 5);
        mark(present, AttendanceRecord.AttendanceStatus.PRESENT);
        mark(unknown, AttendanceRecord.AttendanceStatus.UNKNOWN);
        var report = service.prepare(scope, teacher.getId());
        assertThat(report.document().sections().getFirst().evidence())
                .contains("Past scheduled lessons applicable to this enrolment: 3")
                .contains("Present: 1; late: 0; absent: 0; not recorded: 2")
                .contains("Attendance rate among recorded marks ((present + late) / (present + late + absent)): 100%");
        assertThat(report.document().sections().get(2).evidence()).anyMatch(text -> text.startsWith("No recorded absences"));
        var totals = report.document().snapshot().attendance();
        assertThat(totals).isEqualTo(new AttendanceSummary(3, 1, 0, 0, 2, 100));
        assertThat(report.document().snapshot().attendanceTrend()).hasSize(1);
        assertThat(report.document().snapshot().attendanceTrend().getFirst().attendance()).isEqualTo(totals);
        assertThat(report.document().snapshot().sources().lessons()).hasSize(3)
                .extracting(ReportSourceModels.Lesson::status).containsExactly("PRESENT", "UNKNOWN", "UNKNOWN");
        assertThat(report.document().snapshot().sources().lessons()).extracting(ReportSourceModels.Lesson::sessionId)
                .doesNotContain(scheduled.getId());
    }
    @Test void unlinkedLegacyAttendanceIsExcludedWithoutLosingSelectedClassFacts() {
        var selected = lesson(ClassroomSession.SessionStatus.COMPLETED, 1);
        mark(selected, AttendanceRecord.AttendanceStatus.PRESENT);
        var unlinked = lesson(ClassroomSession.SessionStatus.COMPLETED, 2);
        unlinked.setCourseOffering(null); sessions.saveAndFlush(unlinked);
        mark(unlinked, AttendanceRecord.AttendanceStatus.ABSENT);

        var report = service.prepare(scope, teacher.getId());
        var snapshot = report.document().snapshot();
        assertThat(snapshot.attendance()).isEqualTo(new AttendanceSummary(1, 1, 0, 0, 0, 100));
        assertThat(snapshot.sources().lessons()).extracting(ReportSourceModels.Lesson::sessionId)
                .containsExactly(selected.getId());
        assertThat(report.document().sections().get(2).evidence()).anyMatch(text -> text.startsWith("No recorded absences"));
        assertThat(attendance.findBySession_IdAndStudent_Id(unlinked.getId(), student.getId())).isPresent();
        assertThat(sessions.findById(unlinked.getId()).orElseThrow().getCourseOffering()).isNull();
    }

    @Test void unlinkedLegacyLeaveIsNotAssignedToTheSelectedClass() {
        var selected = lesson(ClassroomSession.SessionStatus.COMPLETED, 1);
        var unlinked = lesson(ClassroomSession.SessionStatus.COMPLETED, 2);
        unlinked.setCourseOffering(null); sessions.saveAndFlush(unlinked);
        saveLeave(selected, "Selected leave");
        saveLeave(unlinked, "Unlinked leave");

        var report = service.prepare(scope, teacher.getId());
        assertThat(report.document().sections().get(2).evidence())
                .anyMatch(text -> text.contains("Selected leave"))
                .noneMatch(text -> text.contains("Unlinked leave"));
        assertThat(leaveRequests.findByStudent_IdOrderBySubmittedAtDesc(student.getId())).hasSize(2);
    }

    private void saveLeave(ClassroomSession session, String reviewNote) {
        var request = new StudentSupportRequest();
        request.setStudent(student); request.setSession(session);
        request.setType(StudentRequestType.LEAVE);
        request.setRequesterRole(StudentRequesterRole.STUDENT);
        request.setContactName(student.getFullName()); request.setContactEmail(student.getUniversityEmail());
        request.setSubject("Leave request"); request.setMessage("Please review."); request.setReviewNote(reviewNote);
        leaveRequests.saveAndFlush(request);
    }

    @Test void snapshotIncludesOnlyReviewedEventsForThisStudentAndCompletedSelectedLessons() {
        var completed = lesson(ClassroomSession.SessionStatus.COMPLETED, 1);
        var future = lesson(ClassroomSession.SessionStatus.SCHEDULED, 2);
        event(completed, BehaviourEvent.ReviewStatus.CONFIRMED, student);
        event(completed, BehaviourEvent.ReviewStatus.CORRECTED, student);
        event(completed, BehaviourEvent.ReviewStatus.PENDING_REVIEW, student);
        event(completed, BehaviourEvent.ReviewStatus.REJECTED, student);
        event(completed, BehaviourEvent.ReviewStatus.CONFIRMED, null);
        event(future, BehaviourEvent.ReviewStatus.CONFIRMED, student);
        var snapshot = service.prepare(scope, teacher.getId()).document().snapshot();
        assertThat(snapshot.confirmedEvents()).containsExactly(new EventCount("Hand raise", 2));
    }
    private void event(ClassroomSession lesson, BehaviourEvent.ReviewStatus status, Student subject) {
        var row = new BehaviourEvent(); row.setSession(lesson); row.setStudent(subject); row.setReviewStatus(status);
        row.setEventType("Hand raise"); row.setExternalEventId(UUID.randomUUID().toString()); row.setTrackId("test");
        row.setModelVersion("test"); row.setConfidence(new java.math.BigDecimal("0.9")); row.setTimestamp(lesson.getStartTime());
        events.save(row);
    }
    @Test void snapshotSurvivesNarrativeEditsAndPublicationWithoutReadingNewSourceState() {
        var present = lesson(ClassroomSession.SessionStatus.COMPLETED, 1);
        mark(present, AttendanceRecord.AttendanceStatus.PRESENT);
        View report = service.prepare(scope, teacher.getId());
        var snapshot = report.document().snapshot();
        for (Section section : report.document().sections()) {
            report = service.save(report.id(), section.topic(), new Edit(report.version(), "Reviewed " + section.title(), true), teacher.getId());
        }
        report = service.publish(report.id(), report.version(), teacher.getId());
        student.setFirstName("Changed"); students.save(student);
        lesson(ClassroomSession.SessionStatus.COMPLETED, 2);
        var frozen = service.get(report.id(), teacher.getId());
        assertThat(frozen.document().snapshot()).isEqualTo(snapshot);
        assertThat(frozen.studentName()).isEqualTo("Report Student");
        var fresh = service.prepare(scope, teacher.getId());
        assertThat(fresh.document().snapshot().attendance().completed()).isEqualTo(2);
        assertThat(fresh.studentName()).isEqualTo("Changed Student");
    }
    @Test void oldStoredDocumentsRemainReadableWithoutInventingHistoricalSnapshot() throws Exception {
        var legacy = "{\"dateFrom\":\"2026-01-01\",\"dateTo\":\"2026-12-31\",\"courseOfferingIds\":[],\"courseLabels\":[],\"sections\":[]}";
        assertThat(json.readValue(legacy, Document.class).snapshot()).isNull();
    }
    @Test void feedbackCountsAndEvidenceUseTheSameSelectedCourseScope() {
        CourseOffering other = new CourseOffering(); other.setCourse(offering.getCourse());
        other.setOfferingCode(UUID.randomUUID().toString()); other.setAcademicTerm("2026");
        other.getTeachers().add(teacher); other = offerings.save(other);
        for (CourseOffering course : List.of(offering, other)) {
            var note = new ProgressReport(); note.setStudent(student); note.setTeacher(teacher);
            note.setCourseOffering(course); note.setComment(course == offering ? "Selected class feedback" : "Outside class feedback");
            feedback.save(note);
        }
        var report = service.prepare(scope, teacher.getId());
        assertThat(report.document().snapshot().feedbackCount()).isEqualTo(1);
        assertThat(report.document().snapshot().sources().feedback()).hasSize(1);
        assertThat(report.document().snapshot().sources().feedback().getFirst().excerpt()).isEqualTo("Selected class feedback");
        assertThat(report.document().sections().get(3).evidence()).anyMatch(text -> text.contains("Selected class feedback"));
        assertThat(report.document().sections().get(3).evidence()).noneMatch(text -> text.contains("Outside class feedback"));
    }
    private ClassroomSession lesson(ClassroomSession.SessionStatus status, int day) {
        var session = new ClassroomSession(); session.setCourse("Report Test"); session.setRoom("Room 1");
        session.setCourseOffering(offering); session.setTeacher(teacher); session.setStatus(status);
        session.setDate(LocalDate.of(2026, 10, day));
        session.setStartTime(Instant.parse("2026-10-01T00:00:00Z").plusSeconds((day - 1) * 86400L));
        session.setEndTime(session.getStartTime().plusSeconds(3600));
        return sessions.save(session);
    }
    private void mark(ClassroomSession session, AttendanceRecord.AttendanceStatus status) {
        var record = new AttendanceRecord(); record.setStudent(student); record.setSession(session); record.setStatus(status);
        attendance.save(record);
    }
    @Test void savedEditsSurviveReopeningAndEditingInvalidatesApproval() {
        var report = service.prepare(scope, teacher.getId());
        report = service.save(report.id(), Topic.ATTENDANCE, new Edit(report.version(), "Reviewed attendance.", true), teacher.getId());
        var reopened = service.prepare(scope, teacher.getId());
        assertThat(reopened.id()).isEqualTo(report.id());
        assertThat(reopened.document().sections().getFirst().reviewed()).isTrue();
        var updated = service.save(reopened.id(), Topic.ATTENDANCE, new Edit(reopened.version(), "Changed wording.", false), teacher.getId());
        assertThat(updated.document().sections().getFirst().text()).isEqualTo("Changed wording.");
        assertThat(updated.document().sections().getFirst().reviewed()).isFalse();
    }
    @Test void failedGenerationPreservesSavedText() {
        var report = service.prepare(scope, teacher.getId());
        var saved = service.save(report.id(), Topic.ABSENCES, new Edit(report.version(), "Keep my edits.", false), teacher.getId());
        when(ai.generate(any(), any())).thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE));
        assertThatThrownBy(() -> service.generate(saved.id(), Topic.ABSENCES, saved.version(), teacher.getId())).isInstanceOf(ResponseStatusException.class);
        assertThat(service.get(saved.id(), teacher.getId()).document().sections().get(2).text()).isEqualTo("Keep my edits.");
    }
    @Test void numericalDraftsDoNotDependOnOrTrustTheModel() {
        var report = service.prepare(scope, teacher.getId());
        when(ai.generate(any(), any())).thenThrow(new IllegalStateException("AI unavailable"));
        var attendanceDraft = service.generate(report.id(), Topic.ATTENDANCE, report.version(), teacher.getId());
        var paymentDraft = service.generate(report.id(), Topic.PAYMENTS, attendanceDraft.version(), teacher.getId());
        assertThat(paymentDraft.document().sections().getFirst().provider()).isEqualTo("RECORDS");
        assertThat(paymentDraft.document().sections().get(1).provider()).isEqualTo("RECORDS");
        assertThat(paymentDraft.document().sections().get(1).reviewed()).isFalse();
        verifyNoInteractions(ai);
    }
    @Test void staleWindowCannotOverwriteNewerEdits() {
        var report = service.prepare(scope, teacher.getId());
        service.save(report.id(), Topic.ATTENDANCE, new Edit(report.version(), "Newer wording.", false), teacher.getId());
        var staleEdit = new Edit(report.version(), "Old window.", true);
        assertThatThrownBy(() -> service.save(report.id(), Topic.ATTENDANCE, staleEdit, teacher.getId()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("another window");
    }
    @Test void deliveryRequiresAllSectionsAndPublishedSnapshotIsFrozen() {
        var initial = service.prepare(scope, teacher.getId());
        assertThatThrownBy(() -> service.publish(initial.id(), initial.version(), teacher.getId()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Review every");
        View reviewed = initial;
        for (Section section : initial.document().sections()) {
            reviewed = service.save(reviewed.id(), section.topic(), new Edit(reviewed.version(), "Approved " + section.title(), true), teacher.getId());
        }
        View published = service.publish(reviewed.id(), reviewed.version(), teacher.getId());
        assertThat(service.published(student.getId())).hasSize(1);
        var forbiddenEdit = new Edit(published.version(), "Changed after publication.", false);
        assertThatThrownBy(() -> service.save(published.id(), Topic.LEARNING, forbiddenEdit, teacher.getId()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("frozen");
        assertThat(service.prepare(scope, teacher.getId()).id()).isNotEqualTo(published.id());
    }
    @Test void achievementsRequireConfirmedReportableAndUncontestedRecords() {
        Accomplishment award = new Accomplishment(); award.setStudent(student); award.setCourseOffering(offering);
        award.setCreatedByTeacher(teacher); award.setCategory(Accomplishment.Category.AWARD); award.setTitle("Verified award");
        award.setAchievementDate(LocalDate.of(2026, 10, 1)); award.setStatus(Accomplishment.Status.CONFIRMED);
        award = achievements.save(award);
        var confirmed = service.prepare(scope, teacher.getId());
        assertThat(confirmed.document().sections()).hasSize(5);
        assertThat(confirmed.document().snapshot().sources().achievements()).extracting(ReportSourceModels.Achievement::id).containsExactly(award.getId());
        AccomplishmentFeedback correction = new AccomplishmentFeedback(); correction.setAccomplishment(award);
        correction.setType(AccomplishmentFeedback.Type.CORRECTION_REQUEST); correction.setStatus(AccomplishmentFeedback.Status.PENDING);
        corrections.save(correction);
        var disputed = service.prepare(scope, teacher.getId());
        assertThat(disputed.document().sections()).hasSize(4);
        assertThat(disputed.document().snapshot().sources().achievements()).isEmpty();
        assertThat(disputed.document().snapshot().sources().pendingCorrections()).isEqualTo(1);
    }
    @Test void swappingIndividualLessonMarksRequiresReviewEvenWhenStudentTotalsAreUnchanged() {
        var one = lesson(ClassroomSession.SessionStatus.COMPLETED, 1);
        var two = lesson(ClassroomSession.SessionStatus.COMPLETED, 2);
        mark(one, AttendanceRecord.AttendanceStatus.PRESENT); mark(two, AttendanceRecord.AttendanceStatus.UNKNOWN);
        var prepared = service.prepare(scope, teacher.getId());
        service.save(prepared.id(), Topic.ATTENDANCE, new Edit(prepared.version(), "Reviewed", true), teacher.getId());
        for (var row : attendance.findBySession_IdIn(List.of(one.getId(), two.getId()))) {
            row.setStatus(row.getSession().getId().equals(one.getId())
                    ? AttendanceRecord.AttendanceStatus.UNKNOWN : AttendanceRecord.AttendanceStatus.PRESENT);
            attendance.save(row);
        }
        var refreshed = service.prepare(scope, teacher.getId());
        assertThat(refreshed.document().snapshot().attendance()).isEqualTo(prepared.document().snapshot().attendance());
        assertThat(refreshed.document().sections().getFirst()).matches(row -> row.stale() && !row.reviewed());
    }
    @Test void unauthorizedTeacherCannotPrepareOrReadReport() {
        Teacher outsider = new Teacher(); outsider.setStaffNumber(UUID.randomUUID().toString());
        outsider.setEmail(UUID.randomUUID() + "@staff.test"); outsider.setName("Outside teacher"); outsider.setRole("TEACHER");
        UUID outsiderId = teachers.save(outsider).getId();
        var report = service.prepare(scope, teacher.getId());
        assertThatThrownBy(() -> service.prepare(scope, outsiderId)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.get(report.id(), outsiderId)).isInstanceOf(ResponseStatusException.class);
    }
    @Test void generationDoesNotAutomaticallyApproveAndLearningKeepsStrengths() {
        var note = new ProgressReport(); note.setStudent(student); note.setTeacher(teacher);
        note.setCourseOffering(offering); note.setComment("Explained an approach clearly; testing needs more detail.");
        feedback.save(note);
        var report = service.prepare(scope, teacher.getId());
        var generated = service.generate(report.id(), Topic.LEARNING, report.version(), teacher.getId());
        var learning = generated.document().sections().get(3);
        assertThat(learning.text()).contains("Strengths", "Next steps", "Recorded strengths.");
        assertThat(learning.reviewed()).isFalse();
        assertThat(learning.provider()).isEqualTo("QWEN:test");
    }
    @Test void deactivationDuringInferenceCannotChangeTheSavedStudentDraft() {
        var note = new ProgressReport(); note.setStudent(student); note.setTeacher(teacher);
        note.setCourseOffering(offering); note.setComment("Recorded teacher feedback."); feedback.save(note);
        var prepared = service.prepare(scope, teacher.getId());
        String original = savedReports.findById(prepared.id()).orElseThrow().getDocument();
        when(ai.generate(any(), any())).thenAnswer(invocation -> {
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            var caller = teachers.findById(teacher.getId()).orElseThrow();
            caller.setStatus("DEACTIVATED"); teachers.saveAndFlush(caller);
            return new Generation("Must not be saved.", "Strength.", "Next step.", "QWEN:test");
        });
        assertThatThrownBy(() -> service.generate(prepared.id(), Topic.LEARNING, prepared.version(), teacher.getId()))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(org.springframework.http.HttpStatus.FORBIDDEN));
        var stored = savedReports.findById(prepared.id()).orElseThrow();
        assertThat(stored.getDocument()).isEqualTo(original);
        assertThat(stored.getVersion()).isEqualTo(prepared.version());
        assertThat(stored.getPublishedAt()).isNull();
        verifyNoInteractions(email);
    }

    @Test void noFeedbackCannotGenerateAnInventedLearningEvaluation() {
        var report = service.prepare(scope, teacher.getId());
        var generated = service.generate(report.id(), Topic.LEARNING, report.version(), teacher.getId());
        var section = generated.document().sections().get(3);
        assertThat(section.text()).isEqualTo("No teacher feedback recorded for the selected courses and dates.");
        assertThat(section.provider()).isEqualTo("RECORDS");
        assertThat(section.reviewed()).isFalse();
        verifyNoInteractions(ai);
    }
    @Test void changedEvidencePreservesWordingButRequiresNewReview() {
        Section old = new Section(Topic.ATTENDANCE, "Attendance", List.of("Old facts"), "old", "My edited text", "QWEN:test", true, false, "Reviewer", null);
        var fresh = new Document(scope.dateFrom(), scope.dateTo(), scope.courseOfferingIds(), List.of("Class"),
                List.of(ReportEvidence.section(Topic.ATTENDANCE, "Attendance", List.of("New facts"))));
        var saved = new Document(scope.dateFrom(), scope.dateTo(), scope.courseOfferingIds(), List.of("Class"), List.of(old));
        var merged = StudentReportService.merge(fresh, saved).sections().getFirst();
        assertThat(merged.text()).isEqualTo("My edited text");
        assertThat(merged.reviewed()).isFalse();
        assertThat(merged.stale()).isTrue();
    }
    @Test void draftingPolicyChangePreservesManualTextButInvalidatesApprovalEvenWithUnchangedFacts() {
        var facts = List.of("Unchanged source records");
        Section old = new Section(Topic.LEARNING, "Teacher feedback summary", facts,
                ReportEvidence.fingerprint(String.join("\n", facts)), "My hand-edited draft", "MANUAL", true, false, "Reviewer", null);
        var fresh = new Document(scope.dateFrom(), scope.dateTo(), scope.courseOfferingIds(), List.of("Class"),
                List.of(ReportEvidence.section(Topic.LEARNING, old.title(), facts)));
        var saved = new Document(scope.dateFrom(), scope.dateTo(), scope.courseOfferingIds(), List.of("Class"), List.of(old));
        var merged = StudentReportService.merge(fresh, saved).sections().getFirst();
        assertThat(merged.text()).isEqualTo("My hand-edited draft");
        assertThat(merged.stale()).isTrue();
        assertThat(merged.reviewed()).isFalse();
        assertThat(merged.reviewedBy()).isNull();
        assertThat(ReportEvidence.current(merged)).isTrue();
    }
    @Test void prematureCompletedFutureLessonsAreExcludedFromEveryPersonalFact() {
        Instant future = Instant.now().plusSeconds(7 * 86400L);
        var lesson = lesson(ClassroomSession.SessionStatus.COMPLETED, 1);
        lesson.setDate(future.atZone(java.time.ZoneId.of("Pacific/Auckland")).toLocalDate());
        lesson.setStartTime(future); lesson.setEndTime(future.plusSeconds(3600));
        lesson = sessions.save(lesson);
        mark(lesson, AttendanceRecord.AttendanceStatus.ABSENT);
        event(lesson, BehaviourEvent.ReviewStatus.CONFIRMED, student);
        var futureScope = new Scope(student.getId(), scope.dateFrom(), lesson.getDate(), scope.courseOfferingIds());
        var report = service.prepare(futureScope, teacher.getId());
        assertThat(report.document().snapshot().attendance()).isEqualTo(new AttendanceSummary(0, 0, 0, 0, 0, null));
        assertThat(report.document().snapshot().attendanceTrend()).isEmpty();
        assertThat(report.document().snapshot().confirmedEvents()).isEmpty();
        assertThat(report.document().snapshot().courses().getFirst().attendance().completed()).isZero();
        assertThat(report.document().sections().get(2).evidence()).anyMatch(text -> text.startsWith("No recorded absences"));
    }
    @Test void refreshedSnapshotHasNewAsOfTimeWhileDraftCreationTimeIsPreserved() {
        var first = service.prepare(scope, teacher.getId());
        var refreshed = service.prepare(scope, teacher.getId());
        assertThat(refreshed.id()).isEqualTo(first.id());
        assertThat(refreshed.createdAt()).isEqualTo(first.createdAt());
        assertThat(refreshed.document().snapshot().preparedAt()).isAfter(first.document().snapshot().preparedAt());
        var saved = service.save(refreshed.id(), Topic.ATTENDANCE, new Edit(refreshed.version(), "Reviewed.", true), teacher.getId());
        assertThat(saved.document().snapshot().preparedAt()).isEqualTo(refreshed.document().snapshot().preparedAt());
        assertThat(StudentReportText.render(saved.document())).contains("Data as of", "NZDT");
    }
    @Test void staleManualDraftCanBeReviewedWithoutRegeneratingButNeedsExplicitAcknowledgement() {
        var draft = service.prepare(scope, teacher.getId());
        service.save(draft.id(), Topic.ATTENDANCE, new Edit(draft.version(), "My carefully edited text.", true), teacher.getId());
        mark(lesson(ClassroomSession.SessionStatus.COMPLETED, 1), AttendanceRecord.AttendanceStatus.LATE);
        var refreshed = service.prepare(scope, teacher.getId());
        assertThat(refreshed.document().sections().getFirst().stale()).isTrue();
        assertThatThrownBy(() -> service.save(refreshed.id(), Topic.ATTENDANCE,
                new Edit(refreshed.version(), "My correction.", true), teacher.getId()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("updated source records");
        var saved = service.save(refreshed.id(), Topic.ATTENDANCE,
                new Edit(refreshed.version(), "My correction.", false, true), teacher.getId());
        assertThat(saved.document().sections().getFirst().stale()).isTrue();
        var approved = service.save(saved.id(), Topic.ATTENDANCE,
                new Edit(saved.version(), "My correction.", true, true), teacher.getId());
        assertThat(approved.document().sections().getFirst().stale()).isFalse();
        assertThat(approved.document().sections().getFirst().reviewed()).isTrue();
        assertThat(approved.document().sections().getFirst().text()).isEqualTo("My correction.");
        verifyNoInteractions(ai);
        assertThatThrownBy(() -> service.save(approved.id(), Topic.ATTENDANCE,
                new Edit(refreshed.version(), "Stale tab.", true, true), teacher.getId()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("another window");
    }
}
