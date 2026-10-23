package io.github.huijingmen.softeng789.classroommonitoring.vision;

import tools.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.service.*;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateAttendanceRequest;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static io.github.huijingmen.softeng789.classroommonitoring.auth.BrowserTestSession.browserSession;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:vision-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop",
    "cv.encryption-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
})
@ActiveProfiles("postgres")
@AutoConfigureMockMvc
class VisionServiceTest {
    @DynamicPropertySource
    static void optionalPostgres(DynamicPropertyRegistry registry) {
        // Explicit, isolated test database only. The caller applies schema + migrations first.
        String url = System.getenv("CV_TEST_DATABASE_URL");
        if (url != null && !url.isBlank()) {
            registry.add("spring.datasource.url", () -> url);
            registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
            registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("CV_TEST_DATABASE_USER", "cv_test"));
            registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("CV_TEST_DATABASE_PASSWORD", ""));
            registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        }
    }
    @Autowired VisionService service;
    @Autowired StudentCheckInService checkins;
    @Autowired StudentCheckInRepository checkinRows;
    @Autowired FaceProfileRepository profiles;
    @Autowired PhotoReviewRepository reviews;
    @Autowired StudentRepository students;
    @Autowired TeacherRepository teachers;
    @Autowired CourseRepository courses;
    @Autowired CourseOfferingRepository offerings;
    @Autowired CourseEnrollmentRepository enrollments;
    @Autowired ClassroomSessionRepository sessions;
    @Autowired AttendanceRecordRepository attendance;
    @Autowired AttendanceService manual;
    @Autowired AttendanceReviewHistory history;
    @Autowired StudentService studentService;
    @Autowired VisionCrypto crypto;
    @Autowired ObjectMapper json;
    @Autowired SessionAuthService auth;
    @Autowired MockMvc mvc;
    @MockitoBean VisionGateway gateway;
    Student student; Teacher teacher; ClassroomSession session; CourseEnrollment enrollment;
    String teacherToken; String studentToken;
    final byte[] image = new byte[]{1, 2, 3}; // Fake image only at the mocked inference boundary.

    @BeforeEach void setup() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        teacher = new Teacher(); teacher.setStaffNumber(suffix); teacher.setEmail(suffix + "@staff.test");
        teacher.setName("Vision Teacher"); teacher.setRole("TEACHER"); teacher = teachers.save(teacher);
        student = new Student(); student.setStudentNumber(suffix); student.setUniversityEmail(suffix + "@student.test");
        student.setFirstName("Vision"); student.setLastName("Student"); student.setCourse("CV"); student.setSeat("A1"); student.setProgramme(""); student = students.save(student);
        Course course = new Course(); course.setCode(suffix); course.setName("Vision Class"); course = courses.save(course);
        CourseOffering offering = new CourseOffering(); offering.setCourse(course); offering.setOfferingCode(suffix);
        offering.setAcademicTerm("2026"); offering.getTeachers().add(teacher); offering = offerings.save(offering);
        enrollment = new CourseEnrollment(); enrollment.setStudent(student); enrollment.setCourseOffering(offering); enrollment = enrollments.save(enrollment);
        session = new ClassroomSession(); session.setCourse("CV"); session.setRoom("Test room"); session.setCourseOffering(offering); session.setTeacher(teacher);
        session.setDate(LocalDate.now()); session.setStartTime(Instant.now().minusSeconds(3600)); session.setEndTime(Instant.now().plusSeconds(3600)); session = sessions.save(session);
        teacherToken = "Bearer " + auth.issueToken("TEACHER", teacher.getId(), teacher.getName(), teacher.getEmail(), "APPROVED").token();
        studentToken = "Bearer " + auth.issueToken("STUDENT", student.getId(), student.getFullName(), student.getUniversityEmail(), "APPROVED").token();
        when(gateway.enabled()).thenReturn(true);
        var response = json.createObjectNode().put("qualityPassed", true).put("modelVersion", "test-model").put("padStatus", "NOT_PERFORMED");
        var templates = response.putArray("templates");
        for (int i = 0; i < 7; i++) { var vector = templates.addArray(); for (int j = 0; j < 128; j++) vector.add(j == 0 ? 1.0 : 0.0); }
        when(gateway.enroll(anyList())).thenReturn(response);
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            var result = json.createObjectNode().put("modelVersion", "test-model").put("thresholdVersion", "test:.5:.08");
            var faces = result.putArray("faces");
            for (int i = 1; i <= 2; i++) {
                var face = faces.addObject().put("faceId", "f" + i).put("decision", i == 1 ? "MATCH_CANDIDATE" : "UNKNOWN");
                face.putObject("box").put("x", .1 * i).put("y", .1).put("width", .2).put("height", .2);
                face.putArray("qualityReasons"); var candidates = face.putArray("candidates");
                if (i == 1) candidates.addObject().put("studentId", student.getId().toString()).put("similarity", .8);
            }
            return result;
        });
    }
    void enroll() {
        service.consent(student.getId(), new VisionService.Consent(true, true, VisionService.NOTICE));
        service.enroll(teacher.getId(), student.getId(), true, Collections.nCopies(7, image));
    }
    VisionService.ReviewResult photo() { return service.recognize(teacher.getId(), session.getId(), UUID.randomUUID(), image, true); }
    VisionService.ReviewRequest decision() { return new VisionService.ReviewRequest(true, List.of(
        new VisionService.Decision("f1", student.getId(), "PRESENT"), new VisionService.Decision("f2", null, "EXCLUDE"))); }

    void singleFace() {
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            var subjects = json.readTree((String) call.getArgument(1));
            assertThat(subjects.size()).isEqualTo(1);
            assertThat(subjects.get(0).path("studentId").asText()).isEqualTo(student.getId().toString());
            var result = json.createObjectNode().put("modelVersion", "test-model").put("thresholdVersion", "test:.5:.08");
            var face = result.putArray("faces").addObject().put("faceId", "f1").put("decision", "MATCH_CANDIDATE");
            face.putObject("box").put("x", .1).put("y", .1).put("width", .2).put("height", .2);
            face.putArray("qualityReasons"); face.putArray("candidates").addObject().put("studentId", student.getId().toString()).put("similarity", .8);
            return result;
        });
    }
    StudentCheckInService.RequestView checkin() {
        return checkins.submit(student.getId(), session.getId(), UUID.randomUUID(), image, true);
    }
    @Test void studentCheckInRequiresTeacherApprovalAndUsesCaptureTime() {
        enroll(); singleFace();
        var workspace = checkins.workspace(student.getId());
        assertThat(workspace.sessions()).hasSize(1);
        assertThat(workspace.sessions().getFirst().canSubmit()).isTrue();
        assertThat(workspace.sessions().getFirst().startTime()).isCloseTo(session.getStartTime(), within(1, ChronoUnit.MILLIS));
        assertThat(workspace.sessions().getFirst().endTime()).isCloseTo(session.getEndTime(), within(1, ChronoUnit.MILLIS));
        var request = checkin(); assertThat(request.state()).isEqualTo("PENDING");
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
        assertThat(checkins.workspace(student.getId()).sessions().getFirst().canSubmit()).isFalse();
        assertThat(checkins.queue(teacher.getId(), session.getId())).hasSize(1);
        var row = checkinRows.findById(request.id()).orElseThrow();
        assertThat(row.encryptedResult).doesNotContain("similarity", "templates", "0.8");
        var result = checkins.decide(teacher.getId(), request.id(), new StudentCheckInService.Decision(true, "LATE"));
        assertThat(result.state()).isEqualTo("LATE");
        var mark = attendance.findBySession_Id(session.getId()).getFirst();
        assertThat(mark.getStatus()).isEqualTo(AttendanceRecord.AttendanceStatus.LATE);
        assertThat(mark.getCheckInTime()).isCloseTo(request.createdAt(), org.assertj.core.api.Assertions.within(1, ChronoUnit.MILLIS));
        assertThat(checkinRows.findById(request.id()).orElseThrow().encryptedResult).isNull();
        checkins.decide(teacher.getId(), request.id(), new StudentCheckInService.Decision(true, "LATE"));
        assertThat(attendance.findBySession_Id(session.getId())).hasSize(1);
        assertThat(history.recent(session.getId())).singleElement().satisfies(event -> {
            assertThat(event.action()).isEqualTo("STUDENT_CHECKIN_APPROVED");
            assertThat(event.actorName()).isEqualTo(teacher.getName());
            assertThat(event.resultingStatus()).isEqualTo("LATE");
        });
        assertThatThrownBy(this::checkin).isInstanceOf(ResponseStatusException.class);
    }
    @Test void studentCheckInKeysAndPendingRequestsPreventDuplicates() {
        enroll(); singleFace(); var key = UUID.randomUUID();
        var first = checkins.submit(student.getId(), session.getId(), key, image, true);
        assertThat(checkins.submit(student.getId(), session.getId(), key, image, true).id()).isEqualTo(first.id());
        verify(gateway, times(1)).recognize(any(), anyString());
        assertThatThrownBy(this::checkin).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> checkins.submit(student.getId(), session.getId(), key, new byte[]{9}, true)).isInstanceOf(ResponseStatusException.class);
        assertThat(checkinRows.findBySessionIdOrderByCreatedAtDesc(session.getId())).hasSize(1);
    }
    @Test void studentCheckInRejectsMultipleUnknownAndLowQualityFaces() {
        enroll(); assertThatThrownBy(this::checkin).isInstanceOf(ResponseStatusException.class).hasMessageContaining("exactly one face");
        singleFace(); var fixture = gateway.recognize(image, "[{\"studentId\":\"" + student.getId() + "\"}]").deepCopy();
        for (var state : List.of("UNKNOWN", "LOW_QUALITY", "UNCERTAIN")) {
            ((tools.jackson.databind.node.ObjectNode) fixture.path("faces").get(0)).put("decision", state);
            doReturn(fixture).when(gateway).recognize(any(), anyString());
            assertThatThrownBy(this::checkin).isInstanceOf(ResponseStatusException.class).hasMessageContaining("could not be verified");
        }
        ((tools.jackson.databind.node.ArrayNode) fixture.path("faces")).removeAll();
        assertThatThrownBy(this::checkin).isInstanceOf(ResponseStatusException.class);
        assertThat(checkinRows.findBySessionIdOrderByCreatedAtDesc(session.getId())).isEmpty();
    }
    @Test void studentCheckInEnforcesWindowMembershipAndConsent() {
        singleFace(); assertThatThrownBy(this::checkin).isInstanceOf(ResponseStatusException.class);
        enroll();
        assertThatThrownBy(() -> checkins.submit(student.getId(), session.getId(), UUID.randomUUID(), image, false)).isInstanceOf(ResponseStatusException.class);
        session.setStartTime(Instant.now().plusSeconds(3600)); session.setEndTime(Instant.now().plusSeconds(7200)); sessions.save(session);
        assertThatThrownBy(this::checkin).isInstanceOf(ResponseStatusException.class).hasMessageContaining("15 minutes");
        session.setStartTime(Instant.now().minusSeconds(3600)); session.setEndTime(Instant.now().minusSeconds(1)); sessions.save(session);
        assertThatThrownBy(this::checkin).isInstanceOf(ResponseStatusException.class);
        session.setEndTime(Instant.now().plusSeconds(3600)); session.setStatus(ClassroomSession.SessionStatus.CANCELLED); sessions.save(session);
        assertThatThrownBy(this::checkin).isInstanceOf(ResponseStatusException.class);
        session.setStatus(ClassroomSession.SessionStatus.SCHEDULED); sessions.save(session);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.WITHDRAWN); enrollments.save(enrollment);
        assertThatThrownBy(this::checkin).isInstanceOf(ResponseStatusException.class).hasMessageContaining("Active class");
        assertThat(checkins.workspace(student.getId()).sessions()).isEmpty();
        verify(gateway, never()).recognize(any(), anyString());
    }
    @Test void rejectionAllowsRecaptureAndNeverWritesAttendance() {
        enroll(); singleFace(); var request = checkin();
        assertThatThrownBy(() -> checkins.decide(teacher.getId(), request.id(), new StudentCheckInService.Decision(false, "PRESENT"))).isInstanceOf(ResponseStatusException.class);
        assertThat(checkins.decide(teacher.getId(), request.id(), new StudentCheckInService.Decision(true, "REJECTED")).state()).isEqualTo("REJECTED");
        assertThat(history.recent(session.getId())).singleElement().satisfies(event -> {
            assertThat(event.action()).isEqualTo("STUDENT_CHECKIN_REJECTED");
            assertThat(event.resultingStatus()).isEqualTo("REJECTED");
        });
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
        assertThat(checkin().state()).isEqualTo("PENDING");
        assertThatThrownBy(() -> checkins.decide(teacher.getId(), request.id(), new StudentCheckInService.Decision(true, "PRESENT"))).isInstanceOf(ResponseStatusException.class);
    }
    @Test void checkInWithdrawalErasesPendingPayloadAndBlocksApproval() {
        enroll(); singleFace(); var request = checkin();
        service.consent(student.getId(), new VisionService.Consent(false, false, VisionService.NOTICE));
        assertThat(checkinRows.findById(request.id()).orElseThrow().encryptedResult).isNull();
        assertThat(checkins.queue(teacher.getId(), session.getId()).getFirst().state()).isEqualTo("EXPIRED");
        assertThatThrownBy(() -> checkins.decide(teacher.getId(), request.id(), new StudentCheckInService.Decision(true, "PRESENT"))).isInstanceOf(ResponseStatusException.class);
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
    }
    @Test void checkInManualCorrectionAndMembershipChangesBlockApproval() {
        enroll(); singleFace(); var request = checkin();
        manual.updateAttendance(session.getId(), student.getId(), new UpdateAttendanceRequest(AttendanceRecord.AttendanceStatus.ABSENT));
        assertThatThrownBy(() -> checkins.decide(teacher.getId(), request.id(), new StudentCheckInService.Decision(true, "PRESENT"))).isInstanceOf(ResponseStatusException.class);
        assertThat(attendance.findBySession_Id(session.getId()).getFirst().getStatus()).isEqualTo(AttendanceRecord.AttendanceStatus.ABSENT);
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.WITHDRAWN); enrollments.save(enrollment);
        assertThatThrownBy(() -> checkins.decide(teacher.getId(), request.id(), new StudentCheckInService.Decision(true, "PRESENT"))).isInstanceOf(ResponseStatusException.class);
    }
    @Test void checkInExpiryAndRetentionAreEnforced() {
        enroll(); singleFace(); var request = checkin();
        var row = checkinRows.findById(request.id()).orElseThrow(); row.expiresAt = Instant.now().minusSeconds(1); checkinRows.save(row);
        assertThatThrownBy(() -> checkins.decide(teacher.getId(), request.id(), new StudentCheckInService.Decision(true, "PRESENT"))).isInstanceOf(ResponseStatusException.class);
        checkins.purge(); assertThat(checkinRows.findById(request.id()).orElseThrow().encryptedResult).isNull();
        row = checkinRows.findById(request.id()).orElseThrow(); row.createdAt = Instant.now().minus(91, ChronoUnit.DAYS); checkinRows.save(row);
        checkins.purge(); assertThat(checkinRows.findById(request.id())).isEmpty();
    }
    @Test void checkInEndpointsEnforceSelfAndTeacherScope() throws Exception {
        enroll(); singleFace();
        mvc.perform(get("/api/vision/students/" + student.getId() + "/check-ins")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/vision/students/" + UUID.randomUUID() + "/check-ins").with(browserSession(studentToken))).andExpect(status().isForbidden());
        mvc.perform(get("/api/vision/students/" + student.getId() + "/check-ins").with(browserSession(studentToken)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"));
        var response = mvc.perform(multipart("/api/vision/students/" + student.getId() + "/sessions/" + session.getId() + "/check-ins")
                .file(new org.springframework.mock.web.MockMultipartFile("image", "capture.jpg", "image/jpeg", image))
                .param("captureConsentConfirmed", "true").header("Idempotency-Key", UUID.randomUUID()).with(browserSession(studentToken)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("similarity", "templates", "revision", "recognition");
        var id = json.readTree(response).path("id").asText();
        mvc.perform(post("/api/vision/check-ins/" + id + "/decision").with(browserSession(studentToken)).contentType("application/json")
                .content("{\"teacherConfirmed\":true,\"status\":\"PRESENT\"}")).andExpect(status().isForbidden());
        Teacher other = new Teacher(); other.setStaffNumber(UUID.randomUUID().toString()); other.setEmail(UUID.randomUUID()+"@staff.test"); other.setName("Other"); other=teachers.save(other);
        final UUID stranger = other.getId();
        assertThatThrownBy(() -> checkins.queue(stranger, session.getId())).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> checkins.decide(stranger, UUID.fromString(id), new StudentCheckInService.Decision(true, "PRESENT"))).isInstanceOf(ResponseStatusException.class);
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
    }
    @Test void checkInWithdrawalDuringInferenceDiscardsResult() throws Exception {
        enroll(); singleFace();
        var fixture = gateway.recognize(image, "[{\"studentId\":\"" + student.getId() + "\"}]");
        var started = new CountDownLatch(1); var release = new CountDownLatch(1);
        doAnswer(call -> { started.countDown(); assertThat(release.await(10, TimeUnit.SECONDS)).isTrue(); return fixture; })
                .when(gateway).recognize(any(), anyString());
        try (var executor = Executors.newSingleThreadExecutor()) {
            var pending = executor.submit(this::checkin);
            assertThat(started.await(10, TimeUnit.SECONDS)).isTrue();
            try { service.consent(student.getId(), new VisionService.Consent(false, false, VisionService.NOTICE)); }
            finally { release.countDown(); }
            assertThatThrownBy(() -> pending.get(10, TimeUnit.SECONDS)).hasCauseInstanceOf(ResponseStatusException.class);
        }
        assertThat(checkinRows.findBySessionIdOrderByCreatedAtDesc(session.getId())).isEmpty();
    }
    @Test void concurrentStudentApprovalsWriteOneMark() throws Exception {
        enroll(); singleFace(); var request = checkin(); var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<StudentCheckInService.RequestView> work = () -> { start.await(); return checkins.decide(teacher.getId(), request.id(), new StudentCheckInService.Decision(true, "PRESENT")); };
            var first = executor.submit(work); var second = executor.submit(work); start.countDown();
            assertThat(first.get(20, TimeUnit.SECONDS).state()).isEqualTo("PRESENT");
            assertThat(second.get(20, TimeUnit.SECONDS).state()).isEqualTo("PRESENT");
        }
        assertThat(attendance.findBySession_Id(session.getId())).hasSize(1);
    }
    @Test void checkInReEnrollmentAndCancelledSessionPreventApproval() {
        enroll(); singleFace(); var request = checkin();
        service.enroll(teacher.getId(), student.getId(), true, Collections.nCopies(7, image));
        assertThat(checkinRows.findById(request.id()).orElseThrow().encryptedResult).isNull();
        assertThatThrownBy(() -> checkins.decide(teacher.getId(), request.id(), new StudentCheckInService.Decision(true, "PRESENT"))).isInstanceOf(ResponseStatusException.class);
        var next = checkin(); session.setStatus(ClassroomSession.SessionStatus.CANCELLED); sessions.save(session);
        assertThatThrownBy(() -> checkins.decide(teacher.getId(), next.id(), new StudentCheckInService.Decision(true, "PRESENT"))).isInstanceOf(ResponseStatusException.class);
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
    }

    @Test void enrollmentIsOptionalForAccountApproval() {
        student.setApprovalStatus("PENDING"); students.save(student);
        studentService.approveStudent(student.getId());
        assertThat(students.findById(student.getId()).orElseThrow().getApprovalStatus()).isEqualTo("APPROVED");
        verifyNoInteractions(gateway);
    }
    @Test void enrollmentRequiresCurrentStudentConsentAndTeacherConfirmation() {
        assertThatThrownBy(() -> service.enroll(teacher.getId(), student.getId(), true, Collections.nCopies(7, image))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.consent(student.getId(), new VisionService.Consent(true, false, VisionService.NOTICE))).isInstanceOf(ResponseStatusException.class);
        service.consent(student.getId(), new VisionService.Consent(true, true, VisionService.NOTICE));
        assertThatThrownBy(() -> service.enroll(teacher.getId(), student.getId(), false, Collections.nCopies(7, image))).isInstanceOf(ResponseStatusException.class);
        verify(gateway, never()).enroll(any());
    }
    @Test void templatesAreEncryptedAndRawImagesAreNotStored() {
        enroll(); var profile = profiles.findById(student.getId()).orElseThrow();
        assertThat(profile.encryptedTemplates).doesNotContain("1.0", "0.0");
        assertThat(crypto.decrypt("template:" + student.getId(), profile.encryptedTemplates)).startsWith("[[1.0");
        assertThat(profile.enrolledBy).isEqualTo(teacher.getId());
        assertThatThrownBy(() -> crypto.decrypt("template:other", profile.encryptedTemplates)).isInstanceOf(ResponseStatusException.class);
    }
    @Test void noAttendanceUntilTeacherReviewAndUnknownDoesNotCreateAbsence() {
        enroll(); var review = photo();
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
        assertThat(review.result().path("roster").get(0).has("revision")).isFalse();
        assertThat(service.review(teacher.getId(), review.id(), decision()).state()).isEqualTo("REVIEWED");
        var rows = attendance.findBySession_Id(session.getId()); assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getStatus()).isEqualTo(AttendanceRecord.AttendanceStatus.PRESENT);
        assertThat(rows.getFirst().getSource()).isEqualTo(AttendanceRecord.AttendanceSource.AI);
        assertThat(reviews.findById(review.id()).orElseThrow().reviewedBy).isEqualTo(teacher.getId());
        service.review(teacher.getId(), review.id(), decision()); assertThat(attendance.findBySession_Id(session.getId())).hasSize(1);
        assertThat(history.recent(session.getId())).singleElement().satisfies(event -> {
            assertThat(event.action()).isEqualTo("CLASSROOM_PHOTO_APPROVED");
            assertThat(event.studentId()).isEqualTo(student.getId());
            assertThat(event.actorName()).isEqualTo(teacher.getName());
        });
    }
    @Test void retryKeysAreIdempotentAndCannotBeReusedForDifferentPhotos() {
        enroll(); UUID key = UUID.randomUUID();
        var first = service.recognize(teacher.getId(), session.getId(), key, image, true);
        assertThat(service.recognize(teacher.getId(), session.getId(), key, image, true).id()).isEqualTo(first.id());
        verify(gateway, times(1)).recognize(any(), anyString());
        assertThatThrownBy(() -> service.recognize(teacher.getId(), session.getId(), key, new byte[]{4}, true)).isInstanceOf(ResponseStatusException.class);
    }
    @Test void incompleteAndDuplicateDecisionsRollbackTheWholeReview() {
        enroll(); var review = photo();
        assertThatThrownBy(() -> service.review(teacher.getId(), review.id(), new VisionService.ReviewRequest(true, List.of(new VisionService.Decision("f1", student.getId(), "PRESENT"))))).isInstanceOf(ResponseStatusException.class);
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
        assertThatThrownBy(() -> service.review(teacher.getId(), review.id(), new VisionService.ReviewRequest(true, List.of(new VisionService.Decision("f1", student.getId(), "PRESENT"), new VisionService.Decision("f2", student.getId(), "LATE"))))).isInstanceOf(ResponseStatusException.class);
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
        assertThat(reviews.findById(review.id()).orElseThrow().state).isEqualTo("PENDING");
        assertThat(history.recent(session.getId())).isEmpty();
    }
    @Test void reviewWorkspaceIsStaffScopedAndAvailableWithoutInference() throws Exception {
        when(gateway.enabled()).thenReturn(false);
        String url = "/api/sessions/" + session.getId() + "/attendance-review";
        mvc.perform(get(url)).andExpect(status().isUnauthorized());
        mvc.perform(get(url).with(browserSession(studentToken))).andExpect(status().isForbidden());
        Teacher other = new Teacher(); other.setStaffNumber(UUID.randomUUID().toString());
        other.setEmail(UUID.randomUUID() + "@staff.test"); other.setName("Other"); other.setRole("TEACHER"); other = teachers.save(other);
        String otherToken = "Bearer " + auth.issueToken("TEACHER", other.getId(), other.getName(), other.getEmail(), "APPROVED").token();
        mvc.perform(get(url).with(browserSession(otherToken))).andExpect(status().isForbidden());
        manual.updateAttendance(session.getId(), student.getId(), new UpdateAttendanceRequest(AttendanceRecord.AttendanceStatus.PRESENT), teacher.getId());
        manual.updateAttendance(session.getId(), student.getId(), new UpdateAttendanceRequest(AttendanceRecord.AttendanceStatus.LATE), teacher.getId());
        mvc.perform(get(url).with(browserSession(teacherToken))).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.attendance[0].status").value("LATE"))
                .andExpect(jsonPath("$.requests").isEmpty())
                .andExpect(jsonPath("$.history.length()").value(2))
                .andExpect(jsonPath("$.history[0].actorName").value(teacher.getName()))
                .andExpect(jsonPath("$.history[0].previousStatus").value("PRESENT"))
                .andExpect(jsonPath("$.history[0].resultingStatus").value("LATE"));
        verify(gateway, never()).recognize(any(), anyString());
    }

    @Test void historyIsBoundedAndInvalidChangesDoNotLeaveEvents() {
        for (int i = 0; i < 102; i++) {
            manual.updateAttendance(session.getId(), student.getId(), new UpdateAttendanceRequest(
                    i % 2 == 0 ? AttendanceRecord.AttendanceStatus.PRESENT : AttendanceRecord.AttendanceStatus.LATE), teacher.getId());
        }
        var entries = history.recent(session.getId());
        assertThat(entries).hasSize(100);
        assertThat(entries.getFirst().resultingStatus()).isEqualTo("LATE");
        assertThat(history.recent(UUID.randomUUID())).isEmpty();
        enrollment.setStatus(CourseEnrollment.EnrollmentStatus.WITHDRAWN); enrollments.save(enrollment);
        assertThatThrownBy(() -> manual.updateAttendance(session.getId(), student.getId(),
                new UpdateAttendanceRequest(AttendanceRecord.AttendanceStatus.PRESENT), teacher.getId())).isInstanceOf(ResponseStatusException.class);
        assertThat(history.recent(session.getId())).isEqualTo(entries);
    }
    @Test void manualAttendanceChangedAfterRecognitionIsNeverOverwritten() {
        enroll(); var review = photo();
        manual.updateAttendance(session.getId(), student.getId(), new UpdateAttendanceRequest(AttendanceRecord.AttendanceStatus.LATE));
        assertThatThrownBy(() -> service.review(teacher.getId(), review.id(), decision())).isInstanceOf(ResponseStatusException.class);
        assertThat(attendance.findBySession_Id(session.getId()).getFirst().getSource()).isEqualTo(AttendanceRecord.AttendanceSource.MANUAL);
    }
    @Test void withdrawingConsentErasesTemplateAndInvalidatesPendingPhoto() {
        enroll(); var review = photo(); service.consent(student.getId(), new VisionService.Consent(false, false, VisionService.NOTICE));
        assertThat(profiles.findById(student.getId()).orElseThrow().encryptedTemplates).isNull();
        assertThat(reviews.findById(review.id()).orElseThrow().encryptedResult).isNull();
        assertThatThrownBy(() -> service.review(teacher.getId(), review.id(), decision())).isInstanceOf(ResponseStatusException.class);
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
    }
    @Test void changedClassMembershipAndReEnrollmentInvalidateReview() {
        enroll(); var review = photo(); enrollment.setStatus(CourseEnrollment.EnrollmentStatus.WITHDRAWN); enrollments.save(enrollment);
        assertThatThrownBy(() -> service.review(teacher.getId(), review.id(), decision())).isInstanceOf(ResponseStatusException.class);
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
    }
    @Test void expiredReviewsCannotWriteAndPurgeRemovesSensitivePayloads() {
        enroll(); var review = photo(); var row = reviews.findById(review.id()).orElseThrow(); row.expiresAt = Instant.now().minusSeconds(10); reviews.save(row);
        assertThatThrownBy(() -> service.review(teacher.getId(), review.id(), decision())).isInstanceOf(ResponseStatusException.class);
        service.purge(); assertThat(reviews.findById(review.id()).orElseThrow().encryptedResult).isNull();
    }
    @Test void accessControlStopsStudentWritesOtherTeachersAndTeacherGivingConsent() throws Exception {
        mvc.perform(get("/api/vision/students/" + student.getId())).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/vision/students/" + student.getId() + "/consent").with(browserSession(teacherToken)).contentType("application/json").content("{\"granted\":true,\"adultConfirmed\":true,\"noticeVersion\":\"adult-pilot-v1\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/vision/sessions/" + session.getId() + "/roster").with(browserSession(studentToken))).andExpect(status().isForbidden());
        Teacher stranger = new Teacher(); stranger.setStaffNumber(UUID.randomUUID().toString()); stranger.setEmail(UUID.randomUUID() + "@staff.test"); stranger.setName("Other"); stranger = teachers.save(stranger);
        final UUID otherId = stranger.getId(); assertThatThrownBy(() -> service.roster(otherId, session.getId())).isInstanceOf(ResponseStatusException.class);
        mvc.perform(get("/api/vision/students/" + student.getId()).with(browserSession(studentToken))).andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"));
    }
    @Test void malformedReviewGets400RatherThan500() throws Exception {
        enroll(); var review = photo();
        for (String decisions : List.of("[null]", "[{\"faceId\":\"f1\",\"status\":null}]", "null")) {
            mvc.perform(post("/api/vision/reviews/" + review.id() + "/confirm").with(browserSession(teacherToken))
                    .contentType("application/json").content("{\"teacherConfirmed\":true,\"decisions\":" + decisions + "}"))
                    .andExpect(status().isBadRequest());
        }
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
    }
    @Test void withdrawalWorksEvenWhenStoredCiphertextCannotBeDecrypted() {
        enroll(); var result = photo(); var row = reviews.findById(result.id()).orElseThrow();
        row.encryptedResult = "unreadable-after-key-loss"; reviews.save(row);
        service.consent(student.getId(), new VisionService.Consent(false, false, VisionService.NOTICE));
        assertThat(reviews.findById(result.id()).orElseThrow().encryptedResult).isNull();
        assertThat(profiles.findById(student.getId()).orElseThrow().encryptedTemplates).isNull();
    }
    @Test void expiryErasesUnreadableTemplatesAndReviews() {
        enroll(); var result = photo(); var profile = profiles.findById(student.getId()).orElseThrow();
        profile.expiresAt = Instant.now().minusSeconds(1); profile.encryptedTemplates = "invalid"; profiles.save(profile);
        service.purge();
        assertThat(profiles.findById(student.getId()).orElseThrow().encryptedTemplates).isNull();
        assertThat(reviews.findById(result.id()).orElseThrow().encryptedResult).isNull();
    }
    @Test void reenrollmentInvalidatesEarlierPhoto() {
        enroll(); var result = photo(); service.enroll(teacher.getId(), student.getId(), true, Collections.nCopies(7, image));
        assertThatThrownBy(() -> service.review(teacher.getId(), result.id(), decision())).isInstanceOf(ResponseStatusException.class);
    }
    @Test void withdrawalDuringInferenceDiscardsResult() throws Exception {
        enroll(); CountDownLatch started = new CountDownLatch(1); CountDownLatch release = new CountDownLatch(1);
        var existingAnswer = gateway.recognize(image, "[]");
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> { started.countDown(); assertThat(release.await(10, TimeUnit.SECONDS)).isTrue(); return existingAnswer; });
        try (var executor = Executors.newSingleThreadExecutor()) {
            Future<?> pending = executor.submit(this::photo);
            assertThat(started.await(10, TimeUnit.SECONDS)).isTrue();
            try { service.consent(student.getId(), new VisionService.Consent(false, false, VisionService.NOTICE)); }
            finally { release.countDown(); }
            assertThatThrownBy(() -> pending.get(10, TimeUnit.SECONDS)).hasCauseInstanceOf(ResponseStatusException.class);
        }
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
    }
    @Test void concurrentIdenticalConfirmationsCreateOneAttendanceMark() throws Exception {
        enroll(); var result = photo(); CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<VisionService.ReviewResult> work = () -> { start.await(); return service.review(teacher.getId(), result.id(), decision()); };
            var first = executor.submit(work); var second = executor.submit(work); start.countDown();
            assertThat(first.get(20, TimeUnit.SECONDS).state()).isEqualTo("REVIEWED");
            assertThat(second.get(20, TimeUnit.SECONDS).state()).isEqualTo("REVIEWED");
        }
        assertThat(attendance.findBySession_Id(session.getId())).hasSize(1);
    }
}
