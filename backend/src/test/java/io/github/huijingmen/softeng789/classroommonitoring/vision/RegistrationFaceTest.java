package io.github.huijingmen.softeng789.classroommonitoring.vision;

import tools.jackson.databind.ObjectMapper;
import io.github.huijingmen.softeng789.classroommonitoring.dto.*;
import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.service.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static io.github.huijingmen.softeng789.classroommonitoring.auth.BrowserTestSession.browserSession;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks.AssistedAccountActivation;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:registration-face-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop",
    "cv.encryption-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
})
@ActiveProfiles("postgres")
@AutoConfigureMockMvc
class RegistrationFaceTest {
    @DynamicPropertySource static void optionalPostgres(DynamicPropertyRegistry registry) {
        String url = System.getenv("CV_TEST_DATABASE_URL");
        if (url != null && !url.isBlank()) {
            registry.add("spring.datasource.url", () -> url);
            registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
            registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("CV_TEST_DATABASE_USER", "cv_test"));
            registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("CV_TEST_DATABASE_PASSWORD", ""));
            registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        }
    }
    @Autowired AuthService registration;
    @Autowired AssistedAccountActivation activation;
    @Autowired StudentService studentsService;
    @Autowired RegistrationFaceService faces;
    @Autowired RegistrationFaceRepository rows;
    @Autowired FaceProfileRepository profiles;
    @Autowired StudentRepository students;
    @Autowired TeacherRepository teachers;
    @Autowired CourseRepository courses;
    @Autowired CourseOfferingRepository offerings;
    @Autowired CourseEnrollmentRepository enrollments;
    @Autowired ClassroomSessionRepository sessions;
    @Autowired AttendanceRecordRepository attendance;
    @Autowired StudentCheckInService checkins;
    @Autowired SessionAuthService auth;
    @Autowired VisionService vision;
    @Autowired ObjectMapper json;
    @Autowired MockMvc mvc;
    @MockitoBean VisionGateway gateway;
    CourseOffering offering;
    Teacher admin;
    String adminToken;
    String teacherToken;
    final byte[] image = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
    final List<String> poses = List.of("front", "slight_left", "left", "slight_right", "right", "chin_up", "chin_down");

    @BeforeEach void setup() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        admin = new Teacher(); admin.setStaffNumber(suffix); admin.setName("Registration Admin");
        admin.setEmail(suffix + "@admin.test"); admin.setRole("ADMIN"); admin = teachers.save(admin);
        adminToken = "Bearer " + auth.issueToken("ADMIN", admin.getId(), admin.getName(), admin.getEmail(), "APPROVED").token();
        var teacher = new Teacher(); teacher.setStaffNumber("t-" + suffix); teacher.setName("Other teacher");
        teacher.setEmail(suffix + "@teacher.test"); teacher = teachers.save(teacher);
        teacherToken = "Bearer " + auth.issueToken("TEACHER", teacher.getId(), teacher.getName(), teacher.getEmail(), "APPROVED").token();
        Course course = new Course(); course.setCode(suffix); course.setName("Registration Class"); course = courses.save(course);
        offering = new CourseOffering(); offering.setCourse(course); offering.setOfferingCode(suffix);
        offering.setAcademicTerm("2026"); offering = offerings.save(offering);
        when(gateway.enabled()).thenReturn(true);
        doAnswer(call -> { if (!gateway.enabled()) throw new ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Disabled"); return null; }).when(gateway).requireEnabled();
        var response = json.createObjectNode().put("qualityPassed", true).put("modelVersion", "test-model");
        var templates = response.putArray("templates");
        for (int i = 0; i < 7; i++) { var vector = templates.addArray(); for (int j = 0; j < 128; j++) vector.add(j == 0 ? 1.0 : 0.0); }
        when(gateway.enroll(anyList())).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return response;
        });
    }
    RegisterStudentRequest request(String mode, boolean consent, boolean adult, String notice) {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        return new RegisterStudentRequest(suffix, suffix + "@student.test", "Registration Student", offering.getCourse().getCode(),
                List.of(offering.getId()), "testing-password", consent, StudentLevel.LEVEL_4, mode, adult, notice);
    }
    RegisterStudentRequest faceRequest() { return request("FACE", true, true, RegistrationFaceService.NOTICE); }
    String metadata() { return "[" + String.join(",", poses.stream().map(p -> "{\"pose\":\"" + p + "\"}").toList()) + "]"; }
    List<MultipartFile> captures() { return poses.stream().map(p -> (MultipartFile)new MockMultipartFile("images", p + ".png", "image/png", image)).toList(); }
    AuthResponse face() { return registration.registerStudent(faceRequest(), metadata(), captures()); }
    AuthResponse manual() { return registration.registerStudent(request("MANUAL", false, false, null), null, List.of()); }

    @Test void publicCaptureCheckRequiresCsrfAndConsentAndDoesNotPersist() throws Exception {
        String path = "/api/auth/registration-capture-check";
        long accounts = students.count(), registrations = rows.count(), faceProfiles = profiles.count();
        var photo = new MockMultipartFile("image", "capture.png", "image/png", image);
        var response = json.createObjectNode().put("accepted", false);
        response.putArray("reasons").add("NO_FACE");
        when(gateway.checkCapture(any())).thenReturn(response);
        mvc.perform(multipart(path).file(photo).param("consentGiven", "true").param("adultConfirmed", "true")
                .param("noticeVersion", RegistrationFaceService.NOTICE)).andExpect(status().isForbidden());
        mvc.perform(multipart(path).file(photo).with(csrf()).param("consentGiven", "false").param("adultConfirmed", "true")
                .param("noticeVersion", RegistrationFaceService.NOTICE)).andExpect(status().isBadRequest());
        verify(gateway, never()).checkCapture(any());
        mvc.perform(multipart(path).file(photo).with(csrf()).param("consentGiven", "true").param("adultConfirmed", "true")
                .param("noticeVersion", RegistrationFaceService.NOTICE)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store")).andExpect(jsonPath("$.accepted").value(false))
                .andExpect(jsonPath("$.reasons[0]").value("NO_FACE")).andExpect(jsonPath("$.templates").doesNotExist());
        assertThat(students.count()).isEqualTo(accounts); assertThat(rows.count()).isEqualTo(registrations);
        assertThat(profiles.count()).isEqualTo(faceProfiles); verify(gateway, never()).enroll(anyList());
    }
    @Test void precheckRejectsDisabledServiceAndOversizeBeforeInference() throws Exception {
        String path = "/api/auth/registration-capture-check";
        mvc.perform(multipart(path).file(new MockMultipartFile("image", "large.png", "image/png", new byte[7 * 1024 * 1024 + 1]))
                .with(csrf()).param("consentGiven", "true").param("adultConfirmed", "true")
                .param("noticeVersion", RegistrationFaceService.NOTICE)).andExpect(status().isPayloadTooLarge());
        when(gateway.enabled()).thenReturn(false);
        mvc.perform(multipart(path).file(new MockMultipartFile("image", "capture.png", "image/png", image))
                .with(csrf()).param("consentGiven", "true").param("adultConfirmed", "true")
                .param("noticeVersion", RegistrationFaceService.NOTICE)).andExpect(status().isServiceUnavailable());
        verify(gateway, never()).checkCapture(any());
    }
    @Test void supervisedPrecheckRequiresTeacherAccessAndActiveConsent() throws Exception {
        var student = manual();
        String path = "/api/vision/students/" + student.id() + "/capture-check";
        var photo = new MockMultipartFile("image", "capture.png", "image/png", image);
        mvc.perform(multipart(path).file(photo).with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(multipart(path).file(photo).with(browserSession("Bearer " + student.token()))).andExpect(status().isForbidden());
        mvc.perform(multipart(path).file(photo).with(browserSession(teacherToken))).andExpect(status().isForbidden());
        mvc.perform(multipart(path).file(photo).with(browserSession(adminToken))).andExpect(status().isForbidden());
        verify(gateway, never()).checkCapture(any());
        studentsService.approveStudent(student.id(), admin.getId(), true);
        vision.consent(student.id(), new VisionService.Consent(true, true, VisionService.NOTICE));
        var response = json.createObjectNode().put("accepted", true); response.putArray("reasons");
        when(gateway.checkCapture(any())).thenReturn(response);
        mvc.perform(multipart(path).file(photo).with(browserSession(adminToken))).andExpect(status().isOk())
                .andExpect(jsonPath("$.accepted").value(true));
        assertThat(vision.profile(student.id()).enrolled()).isFalse();
    }

    @Test void manualRegistrationNeedsAdminApprovalWithoutPhotosOrCv() throws Exception {
        when(gateway.enabled()).thenReturn(false);
        var result = manual();
        assertThat(result.approvalStatus()).isEqualTo("PENDING");
        assertThat(enrollments.findByStudent_IdAndStatus(result.id(), CourseEnrollment.EnrollmentStatus.PENDING)).hasSize(1);
        mvc.perform(post("/api/admin/students/" + result.id() + "/approve").with(browserSession(teacherToken))
                .contentType("application/json").content("{\"identityConfirmed\":true}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/students/" + result.id() + "/approve").with(browserSession(adminToken))
                .contentType("application/json").content("{\"identityConfirmed\":false}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/students/" + result.id() + "/approve").with(browserSession(adminToken))
                .contentType("application/json").content("{\"identityConfirmed\":true}")).andExpect(status().isOk());
        assertThat(registration.me(result.token()).approvalStatus()).isEqualTo("APPROVED");
        assertThat(enrollments.findByStudent_IdAndStatus(result.id(), CourseEnrollment.EnrollmentStatus.ACTIVE)).hasSize(1);
        assertThat(profiles.findById(result.id())).isEmpty();
        verify(gateway, never()).enroll(anyList());
    }
    @Test void facePhotosStayPrivateAndInactiveUntilAdminApprovalThenEnableCheckIn() throws Exception {
        var result = face();
        assertThat(result.approvalStatus()).isEqualTo("PENDING");
        assertThat(vision.profile(result.id()).enrolled()).isFalse();
        assertThat(rows.findById(result.id()).orElseThrow().encryptedPayload).doesNotContain("templates", "data:image");
        mvc.perform(get("/api/admin/students/" + result.id() + "/registration-face")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/students/" + result.id() + "/registration-face").with(browserSession(teacherToken))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/students/" + result.id() + "/registration-face").with(browserSession("Bearer " + result.token()))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/students/" + result.id() + "/registration-face").with(browserSession(adminToken)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.photos.length()").value(7)).andExpect(jsonPath("$.templates").doesNotExist());
        assertThatThrownBy(() -> studentsService.approveStudent(result.id())).isInstanceOf(ResponseStatusException.class);
        assertThat(registration.me(result.token()).approvalStatus()).isEqualTo("PENDING");
        studentsService.approveStudent(result.id(), admin.getId(), true);
        assertThat(rows.findById(result.id()).orElseThrow().encryptedPayload).isNull();
        assertThat(vision.profile(result.id()).enrolled()).isTrue();
        var profile = profiles.findById(result.id()).orElseThrow();
        assertThat(profile.enrolledBy).isEqualTo(admin.getId());
        assertThat(profile.encryptedTemplates).doesNotContain("templates", "[1.0");
        var session = new ClassroomSession(); session.setCourse("Test"); session.setRoom("Test room"); session.setTeacher(admin);
        session.setCourseOffering(offering); session.setDate(LocalDate.now());
        session.setStartTime(Instant.now().minusSeconds(60));
        session.setEndTime(Instant.now().plusSeconds(3600)); session = sessions.save(session);
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            var subjects = json.readTree((String)call.getArgument(1));
            assertThat(subjects.get(0).path("studentId").asText()).isEqualTo(result.id().toString());
            assertThat(subjects.get(0).path("templates").size()).isEqualTo(7);
            var recognized = json.createObjectNode().put("modelVersion", "test-model").put("thresholdVersion", "test");
            var f = recognized.putArray("faces").addObject().put("faceId", "f1").put("decision", "MATCH_CANDIDATE");
            f.putObject("box").put("x", .1).put("y", .1).put("width", .2).put("height", .2); f.putArray("qualityReasons");
            f.putArray("candidates").addObject().put("studentId", result.id().toString()).put("similarity", .9);
            return recognized;
        });
        var checkin = checkins.submit(result.id(), session.getId(), UUID.randomUUID(), image, true);
        assertThat(checkin.state()).isEqualTo("PENDING");
        assertThat(attendance.findBySession_Id(session.getId())).isEmpty();
        checkins.decide(admin.getId(), checkin.id(), new StudentCheckInService.Decision(true, "PRESENT"));
        assertThat(attendance.findBySession_Id(session.getId())).hasSize(1);
    }
    @Test void rejectsInvalidConsentAndIncompleteOrDuplicatePromptsBeforeCreatingAccount() {
        for (var r : List.of(request("FACE", false, true, RegistrationFaceService.NOTICE),
                request("FACE", true, false, RegistrationFaceService.NOTICE), request("FACE", true, true, "old-notice"))) {
            assertThatThrownBy(() -> registration.registerStudent(r, metadata(), captures())).isInstanceOf(ResponseStatusException.class);
            assertThat(students.findByStudentNumberIgnoreCase(r.studentNumber())).isEmpty();
        }
        var r = faceRequest();
        assertThatThrownBy(() -> registration.registerStudent(r, metadata(), captures().subList(0, 6))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> registration.registerStudent(r, metadata().replace("chin_down", "front"), captures())).isInstanceOf(ResponseStatusException.class);
        assertThat(students.findByStudentNumberIgnoreCase(r.studentNumber())).isEmpty();
        verify(gateway, never()).enroll(anyList());
    }
    @Test void failedInferenceCreatesNoAccountOrClassRequest() {
        var r = faceRequest();
        when(gateway.enroll(anyList())).thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY, "Each capture must contain exactly one face."));
        assertThatThrownBy(() -> registration.registerStudent(r, metadata(), captures())).isInstanceOf(ResponseStatusException.class);
        assertThat(students.findByStudentNumberIgnoreCase(r.studentNumber())).isEmpty();
    }
    @Test void invalidModelResponseRollsBackRegistration() {
        var r = faceRequest(); when(gateway.enroll(anyList())).thenReturn(json.createObjectNode());
        assertThatThrownBy(() -> registration.registerStudent(r, metadata(), captures())).isInstanceOf(ResponseStatusException.class);
        assertThat(students.findByStudentNumberIgnoreCase(r.studentNumber())).isEmpty();
    }
    @Test void rejectedRegistrationErasesPhotosAndNeverActivatesTemplates() {
        var result = face(); studentsService.rejectStudent(result.id());
        assertThat(rows.findById(result.id()).orElseThrow().encryptedPayload).isNull();
        assertThat(profiles.findById(result.id())).isEmpty();
        assertThat(enrollments.findByStudent_IdAndStatus(result.id(), CourseEnrollment.EnrollmentStatus.PENDING)).isEmpty();
        assertThatThrownBy(() -> studentsService.approveStudent(result.id(), admin.getId(), true)).isInstanceOf(ResponseStatusException.class);
    }
    @Test void expiryBlocksFaceApprovalAndStudentCanSwitchToManual() {
        var result = face(); var row = rows.findById(result.id()).orElseThrow(); row.expiresAt = Instant.now().minusSeconds(1); rows.save(row);
        assertThat(faces.review(result.id()).photos()).isEmpty();
        assertThatThrownBy(() -> studentsService.approveStudent(result.id(), admin.getId(), true)).isInstanceOf(ResponseStatusException.class);
        faces.purge(); assertThat(rows.findById(result.id()).orElseThrow().encryptedPayload).isNull();
        faces.useManual(result.id()); studentsService.approveStudent(result.id(), admin.getId(), true);
        assertThat(registration.me(result.token()).approvalStatus()).isEqualTo("APPROVED");
        assertThat(profiles.findById(result.id())).isEmpty();
    }
    @Test void onlyStudentSelfCanRemovePendingBiometrics() throws Exception {
        var result = face(); var other = manual();
        String path = "/api/auth/students/" + result.id() + "/registration-attendance/manual";
        mvc.perform(put(path).with(browserSession("Bearer " + other.token()))).andExpect(status().isForbidden());
        mvc.perform(put(path).with(browserSession(adminToken))).andExpect(status().isForbidden());
        mvc.perform(put(path).with(browserSession("Bearer " + result.token()))).andExpect(status().isOk());
        assertThat(rows.findById(result.id()).orElseThrow().encryptedPayload).isNull();
        assertThat(students.findById(result.id()).orElseThrow().isConsentGiven()).isFalse();
        studentsService.approveStudent(result.id(), admin.getId(), true);
        assertThat(profiles.findById(result.id())).isEmpty();
        mvc.perform(put(path).with(browserSession("Bearer " + result.token()))).andExpect(status().isConflict());
    }
    @Test void manualCannotSmugglePhotosAndDisabledFaceCannotCreateAccount() {
        var r = request("MANUAL", false, false, null);
        assertThatThrownBy(() -> registration.registerStudent(r, metadata(), captures())).isInstanceOf(ResponseStatusException.class);
        when(gateway.enabled()).thenReturn(false);
        var face = faceRequest(); assertThatThrownBy(() -> registration.registerStudent(face, metadata(), captures())).isInstanceOf(ResponseStatusException.class);
        assertThat(students.findByStudentNumberIgnoreCase(face.studentNumber())).isEmpty();
    }
    @Test void registrationOptionsArePublic() throws Exception {
        mvc.perform(get("/api/auth/registration-options"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.faceEnabled").value(true));
    }
    @Test void browserMultipartRegistrationCreatesPendingFaceReview() throws Exception {
        var r = faceRequest(); var call = multipart("/api/auth/register/student")
                .file(new MockMultipartFile("registration", "", "application/json", json.writeValueAsBytes(r)))
                .file(new MockMultipartFile("metadata", "", "text/plain", metadata().getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        for (MultipartFile capture : captures()) call.file((MockMultipartFile)capture);
        mvc.perform(call.with(csrf().asHeader())).andExpect(status().isCreated()).andExpect(jsonPath("$.approvalStatus").value("PENDING"));
        var student = students.findByStudentNumberIgnoreCase(r.studentNumber()).orElseThrow();
        assertThat(faces.review(student.getId()).photos()).hasSize(7);
    }
    @Test void claimingPreprovisionedStudentStillRequiresApprovalAndCannotClaimTwice() {
        var r = request("MANUAL", false, false, null);
        var student = new Student(); student.setStudentNumber(r.studentNumber()); student.setUniversityEmail(r.universityEmail());
        student.setFirstName("Invited"); student.setLastName("Student"); student.setCourse("Test"); student.setSeat("Unassigned"); student.setProgramme("");
        student = students.save(student);
        assertThatThrownBy(() -> registration.registerStudent(r, null, List.of()))
                .isInstanceOf(ResponseStatusException.class);
        String proof = activation.issue(admin.getId(), AssistedAccountActivation.Kind.STUDENT, student.getId()).link().split("account-link=")[1];
        var verified = new RegisterStudentRequest(r.studentNumber(), r.universityEmail(), r.fullName(), r.course(),
                r.classOfferingIds(), r.password(), r.consentGiven(), r.level(), r.attendanceMode(), r.adultConfirmed(), r.noticeVersion(), proof);
        var claimed = registration.registerStudent(verified, null, List.of());
        assertThat(claimed.id()).isEqualTo(student.getId()); assertThat(claimed.approvalStatus()).isEqualTo("PENDING");
        assertThatThrownBy(() -> registration.registerStudent(r, null, List.of())).isInstanceOf(ResponseStatusException.class);
    }
    @Test void omittingAttendanceModeCannotBypassReviewOfClaimedAccount() {
        var r = request(null, false, false, null);
        var student = new Student(); student.setStudentNumber(r.studentNumber()); student.setUniversityEmail(r.universityEmail());
        student.setFirstName("Invited"); student.setLastName("Student"); student.setCourse("Test"); student.setSeat("Unassigned"); student.setProgramme("");
        student = students.save(student);
        assertThatThrownBy(() -> registration.registerStudent(r, null, List.of()))
                .isInstanceOf(ResponseStatusException.class);
        String proof = activation.issue(admin.getId(), AssistedAccountActivation.Kind.STUDENT, student.getId()).link().split("account-link=")[1];
        var verified = new RegisterStudentRequest(r.studentNumber(), r.universityEmail(), r.fullName(), r.course(),
                r.classOfferingIds(), r.password(), r.consentGiven(), r.level(), r.attendanceMode(), r.adultConfirmed(), r.noticeVersion(), proof);
        var claimed = registration.registerStudent(verified, null, List.of());
        assertThat(claimed.approvalStatus()).isEqualTo("PENDING");
    }
}
