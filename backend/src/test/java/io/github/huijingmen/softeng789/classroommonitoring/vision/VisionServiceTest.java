package io.github.huijingmen.softeng789.classroommonitoring.vision;

import tools.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.service.*;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateAttendanceRequest;
import java.time.*;
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
