package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import io.github.huijingmen.softeng789.classroommonitoring.entity.*;
import io.github.huijingmen.softeng789.classroommonitoring.repository.*;
import io.github.huijingmen.softeng789.classroommonitoring.service.*;
import io.github.huijingmen.softeng789.classroommonitoring.vision.*;
import jakarta.persistence.EntityManager;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.*;
import tools.jackson.databind.node.ObjectNode;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static io.github.huijingmen.softeng789.classroommonitoring.auth.BrowserTestSession.browserSession;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:kiosk-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "cv.encryption-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
})
@ActiveProfiles("postgres") @AutoConfigureMockMvc
class KioskServiceTest {
    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean KioskSessionService service;
    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean KioskPayloads payloads;
    @Autowired CampusService campusService;
    @Autowired jakarta.persistence.EntityManagerFactory entityManagerFactory;
    @Autowired KioskCaptureService captures;
    @Autowired KioskDecisionService decisions;
    @Autowired KioskReviewService reviews;
    @Autowired KioskRetention retention;
    @Autowired VisionService vision;
    @Autowired SessionAuthService auth;
    @Autowired StudentRepository students;
    @Autowired TeacherRepository teachers;
    @Autowired CourseRepository courses;
    @Autowired CourseOfferingRepository offerings;
    @Autowired CourseEnrollmentRepository enrollments;
    @Autowired ClassroomSessionRepository classrooms;
    @Autowired AttendanceRecordRepository attendance;
    @Autowired EntityManager em;
    @Autowired ObjectMapper json;
    @Autowired MockMvc mvc;
    @MockitoBean VisionGateway gateway;
    Teacher teacher, admin, other;
    Student student, second, third;
    ClassroomSession classroom;
    CourseOffering offering;
    Campus campus;
    UUID kiosk;
    String cookie, staffCookie, adminCookie, otherCookie;
    byte[] image = {(byte)255, (byte)216, (byte)255, 1, 2, 3};

    @BeforeEach void setup() {
        teacher = staff("TEACHER"); admin = staff("ADMIN"); other = staff("TEACHER");
        var course = new Course(); course.setCode(UUID.randomUUID().toString()); course.setName("Synthetic kiosk course"); course = courses.save(course);
        offering = new CourseOffering(); offering.setCourse(course); offering.setOfferingCode(UUID.randomUUID().toString());
        offering.setAcademicTerm("2026"); offering.getTeachers().add(teacher); offering = offerings.save(offering);
        classroom = new ClassroomSession(); classroom.setCourse("Kiosk Test"); classroom.setRoom("Test Room"); classroom.setTeacher(teacher);
        classroom.setCourseOffering(offering); classroom.setStartTime(Instant.now().minusSeconds(300)); classroom.setEndTime(Instant.now().plusSeconds(3600));
        classroom.setDate(Instant.now().atZone(SessionClock.AUCKLAND).toLocalDate()); classroom = classrooms.save(classroom);
        campus = service.tx.execute(s -> { var c = new Campus(); c.setName(UUID.randomUUID().toString()); em.persist(c); return c; });
        when(gateway.enabled()).thenReturn(true);
        var enrolled = json.createObjectNode().put("qualityPassed", true).put("modelVersion", "test-model");
        var vectors = enrolled.putArray("templates");
        for (int i = 0; i < 7; i++) { var vector = vectors.addArray(); for (int j = 0; j < 128; j++) vector.add(j == 0 ? 1.0 : 0.0); }
        when(gateway.enroll(anyList())).thenReturn(enrolled);
        student = student("Minji", "Kim", true);
        second = student("Alex", "Lee", true);
        third = student("Jamie", "Park", true);
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> recognition("MATCH_CANDIDATE", 1));
        staffCookie = token(teacher); adminCookie = token(admin); otherCookie = token(other);
        kiosk = service.tx.execute(s -> service.launch(teacher.getId(), launch(10)).id);
        cookie = auth.issueTokenUntil("KIOSK", kiosk, "Test entrance", null, "APPROVED", service.expiry(kiosk)).token();
    }
    Teacher staff(String role) {
        String id = UUID.randomUUID().toString();
        var t = new Teacher(); t.setStaffNumber(id); t.setName("Synthetic staff"); t.setEmail(id + "@example.test"); t.setRole(role);
        return teachers.save(t);
    }
    String token(Teacher t) { return auth.issueToken(t.getRole(), t.getId(), t.getName(), t.getEmail(), "APPROVED").token(); }
    Student student(String first, String last, boolean face) {
        String id = UUID.randomUUID().toString();
        var st = new Student(); st.setStudentNumber(id); st.setUniversityEmail(id + "@example.test"); st.setFirstName(first); st.setLastName(last);
        st.setCourse("Test"); st.setSeat("A1"); st.setProgramme(""); st = students.save(st);
        var enrollment = new CourseEnrollment(); enrollment.setStudent(st); enrollment.setCourseOffering(offering); enrollments.save(enrollment);
        if (face) {
            vision.consent(st.getId(), new VisionService.Consent(true, true, VisionService.NOTICE));
            vision.enroll(teacher.getId(), st.getId(), true, Collections.nCopies(7, image));
        }
        return st;
    }
    KioskSessionService.Launch launch(Integer grace) { return new KioskSessionService.Launch(classroom.getId(), campus.getId(), "Test entrance", grace, true); }
    ObjectNode recognition(String decision, int faces) {
        var result = json.createObjectNode().put("modelVersion", "test-model").put("thresholdVersion", "test");
        var rows = result.putArray("faces");
        for (int i = 0; i < faces; i++) {
            var face = rows.addObject().put("faceId", "f" + i).put("decision", decision);
            face.putObject("box").put("x", .1).put("y", .1).put("width", .4).put("height", .4);
            var reasons = face.putArray("qualityReasons"); if ("LOW_QUALITY".equals(decision)) reasons.add("BLUR");
            var candidates = face.putArray("candidates");
            if (Set.of("MATCH_CANDIDATE", "UNCERTAIN").contains(decision))
                for (var st : List.of(student, second, third)) candidates.addObject().put("studentId", st.getId().toString()).put("similarity", .8);
        }
        return result;
    }
    UUID capture() { return (UUID) captures.capture(kiosk, UUID.randomUUID(), image).body().get("attemptId"); }
    void mutateAttempt(UUID id, Consumer<KioskAttempt> action) { service.tx.executeWithoutResult(s -> action.accept(em.find(KioskAttempt.class, id))); }
    void mutateKiosk(Consumer<KioskSession> action) { service.tx.executeWithoutResult(s -> action.accept(em.find(KioskSession.class, kiosk))); }
    void mutateClass(Consumer<ClassroomSession> action) { service.tx.executeWithoutResult(s -> action.accept(em.find(ClassroomSession.class, classroom.getId()))); }
    KioskAttempt row(UUID id) { return service.tx.execute(s -> em.find(KioskAttempt.class, id)); }
    long reviewCount(UUID id) { return service.tx.execute(s -> em.createQuery("select count(r) from KioskReviewItem r where r.attemptId = :id", Long.class).setParameter("id", id).getSingleResult()); }
    long historyCount(UUID studentId) { return service.tx.execute(s -> em.createQuery("select count(e) from AttendanceReviewEvent e where e.sessionId = :session and e.student.id = :student", Long.class).setParameter("session", classroom.getId()).setParameter("student", studentId).getSingleResult()); }
    UUID reviewId(UUID attempt) { return service.tx.execute(s -> em.createQuery("select r.id from KioskReviewItem r where r.attemptId = :id", UUID.class).setParameter("id", attempt).getSingleResult()); }
    void error(String code, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(KioskProblem.class, e -> assertThat(e.getBody().getProperties()).containsEntry("code", code));
    }
    @Test void launchIsScopedAndAtomicallyReplacesStaffCookie() throws Exception {
        mvc.perform(post("/api/kiosk/sessions").with(browserSession(otherCookie)).contentType("application/json").content(json.writeValueAsString(launch(10))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        var response = mvc.perform(post("/api/kiosk/sessions").with(browserSession(adminCookie)).contentType("application/json").content(json.writeValueAsString(launch(10))))
                .andExpect(status().isCreated()).andExpect(header().string("Cache-Control", "no-store")).andReturn().getResponse();
        String credential = response.getCookie("classlens-session").getValue();
        assertThat(auth.resolve(adminCookie)).isNull(); assertThat(auth.resolve(credential).role()).isEqualTo("KIOSK");
        mvc.perform(get("/api/auth/me").with(browserSession(credential))).andExpect(status().isOk())
                .andExpect(jsonPath("$.token").doesNotExist()).andExpect(jsonPath("$.role").value("KIOSK")).andExpect(jsonPath("$.name").value("Test entrance"));
        var identity = mvc.perform(get("/api/auth/me").with(browserSession(credential))).andReturn().getResponse();
        var identityJson = json.readTree(identity.getContentAsString());
        assertThat(identityJson.has("token")).isTrue(); assertThat(identityJson.path("token").isNull()).isTrue();
        assertThat(response.getCookie("classlens-session").getMaxAge()).isBetween(1, 43200);
        var options = json.valueToTree(service.options(other.getId(), classroom.getDate(), null));
        assertThat(options.path("sessions").toString()).doesNotContain(classroom.getId().toString());
    }
    @Test void kioskScopeBlocksAllOtherPortalsAndAllowsDeviceHealthCsrf() throws Exception {
        for (String path : List.of("/api/vision/status", "/api/admin/kiosk-reviews", "/api/students/" + student.getId() + "/schedule"))
            mvc.perform(get(path).with(browserSession(cookie))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("KIOSK_SCOPE"));
        mvc.perform(patch("/api/attendance/" + UUID.randomUUID()).with(browserSession(cookie)).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("KIOSK_SCOPE"));
        for (String path : List.of("/api/kiosk/device", "/api/health", "/api/auth/csrf"))
            mvc.perform(get(path).with(browserSession(cookie))).andExpect(status().isOk());
        assertThatThrownBy(() -> auth.requireTeacher("Bearer " + cookie)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> auth.requireAdmin("Bearer " + cookie)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> auth.requireSelfOrTeacher("Bearer " + cookie, student.getId())).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> auth.requireStudentSelf("Bearer " + cookie, student.getId())).isInstanceOf(ResponseStatusException.class);
    }
    @Test void logoutRevokesAndEndsDevice() throws Exception {
        mvc.perform(post("/api/auth/logout").with(browserSession(cookie))).andExpect(status().isNoContent());
        assertThat(auth.resolve(cookie)).isNull();
        assertThat(service.tx.<String>execute(s -> em.find(KioskSession.class, kiosk).endReason)).isEqualTo("DEVICE_EXIT");
        mvc.perform(get("/api/kiosk/device").with(browserSession(cookie))).andExpect(status().isUnauthorized());
    }
    @Test void staffEndRevokesIdempotently() {
        service.end(teacher.getId(), kiosk); service.end(teacher.getId(), kiosk); assertThat(auth.resolve(cookie)).isNull();
    }
    @Test void expiryRevokes() { mutateKiosk(k -> k.expiresAt = Instant.now().minusSeconds(1)); assertThat(auth.resolve(cookie)).isNull(); }
    @Test void deactivatedLauncherRevokesPermanently() {
        service.tx.executeWithoutResult(s -> em.find(Teacher.class, teacher.getId()).setStatus("INACTIVE")); assertThat(auth.resolve(cookie)).isNull();
        service.tx.executeWithoutResult(s -> em.find(Teacher.class, teacher.getId()).setStatus("ACTIVE")); assertThat(auth.resolve(cookie)).isNull();
    }
    @Test void removedTeacherRevokes() {
        service.tx.executeWithoutResult(s -> em.find(CourseOffering.class, offering.getId()).getTeachers().clear());
        assertThat(auth.resolve(cookie)).isNull();
    }
    @Test void captureReplayAndDigestConflict() {
        UUID key = UUID.randomUUID(); var first = captures.capture(kiosk, key, image);
        var replay = captures.capture(kiosk, key, image);
        assertThat(replay.body()).isEqualTo(first.body()); assertThat(replay.replayed()).isTrue();
        verify(gateway, times(1)).recognize(any(), anyString());
        byte[] changed = image.clone(); changed[4]++;
        error("IDEMPOTENCY_KEY_REUSED", () -> captures.capture(kiosk, key, changed));
    }
    @Test void captureOutcomesAndNoSensitiveResponseFields() {
        for (String outcome : List.of("NO_FACE", "MULTIPLE_FACES", "LOW_QUALITY", "NO_CANDIDATE", "UNCERTAIN", "MATCH_CANDIDATE")) {
            mutateKiosk(k -> k.lastCaptureAt = null);
            when(gateway.recognize(any(), anyString())).thenReturn(recognition("NO_CANDIDATE".equals(outcome) ? "UNKNOWN" : Set.of("NO_FACE", "MULTIPLE_FACES").contains(outcome) ? "UNKNOWN" : outcome,
                    "NO_FACE".equals(outcome) ? 0 : "MULTIPLE_FACES".equals(outcome) ? 2 : 1));
            var capture = captures.capture(kiosk, UUID.randomUUID(), image); UUID id = (UUID) capture.body().get("attemptId");
            boolean candidate = Set.of("UNCERTAIN", "MATCH_CANDIDATE").contains(outcome);
            assertThat(capture.body().get("outcome")).isEqualTo(candidate ? "CANDIDATES" : outcome);
            String response = json.writeValueAsString(capture.body());
            assertThat(response).doesNotContain("studentId", "studentNumber", "similarity", "recognitionDecision", "attendanceStatus", student.getId().toString());
            if (!candidate) {
                assertThat(row(id).encryptedCapture).isNull(); assertThat(row(id).processedAt).isNotNull();
                assertThat(service.tx.<KioskEvidence>execute(s -> em.find(KioskEvidence.class, id))).isNull();
            }
        }
    }
    @Test void snapshotExcludesUnreadyInactiveUnapprovedAndUnenrolled() {
        var noFace = student("No", "Face", false);
        var inactive = student("Inactive", "Student", true); inactive.setStatus("INACTIVE"); students.save(inactive);
        var pending = student("Pending", "Student", true); pending.setApprovalStatus("PENDING"); students.save(pending);
        var unenrolled = student("Unenrolled", "Student", true);
        enrollments.delete(enrollments.findByStudent_IdAndCourseOffering_Id(unenrolled.getId(), offering.getId()).orElseThrow());
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            String subjects = call.getArgument(1);
            for (var st : List.of(noFace, inactive, pending, unenrolled)) assertThat(subjects).doesNotContain(st.getId().toString());
            return recognition("MATCH_CANDIDATE", 1);
        });
        capture();
    }
    @Test void confirmRankOneWritesKioskHistoryAndThirtyDayEvidence() {
        UUID id = capture(); var result = decisions.confirm(kiosk, id, "c1");
        assertThat(result).containsEntry("result", "CONFIRMED").containsEntry("attendanceStatus", "PRESENT").containsEntry("replayed", false);
        var record = attendance.findBySession_IdAndStudent_Id(classroom.getId(), student.getId()).orElseThrow();
        assertThat(record.getSource()).isEqualTo(AttendanceRecord.AttendanceSource.KIOSK);
        assertThat(record.getCheckInTime()).isEqualTo(row(id).capturedAt);
        assertThat(historyCount(student.getId())).isEqualTo(1); assertThat(reviewCount(id)).isZero();
        var evidence = service.tx.execute(s -> em.find(KioskEvidence.class, id));
        assertThat(evidence.deleteAfter).isEqualTo(row(id).capturedAt.plus(Duration.ofDays(30)));
        assertThat(row(id).encryptedCandidates).isNull(); assertThat(row(id).encryptedCapture).isNull();
        assertThat(decisions.confirm(kiosk, id, "c1")).containsEntry("replayed", true);
        error("ATTEMPT_FINALIZED", () -> decisions.confirm(kiosk, id, "c2"));
    }
    @Test void lateUsesCaptureTimeAndNullGraceIsAlwaysPresent() {
        mutateKiosk(k -> k.lateAfterMinutes = 0);
        assertThat(decisions.confirm(kiosk, capture(), "c1")).containsEntry("attendanceStatus", "LATE");
        mutateKiosk(k -> { k.lastCaptureAt = null; k.lateAfterMinutes = null; });
        assertThat(decisions.confirm(kiosk, capture(), "c2")).containsEntry("attendanceStatus", "PRESENT");
    }
    @Test void rankTwoAndThreeCreateOneMismatchReviewAndReplayDoesNotDuplicate() {
        for (int rank : List.of(2, 3)) {
            mutateKiosk(k -> k.lastCaptureAt = null); UUID id = capture();
            decisions.confirm(kiosk, id, "c" + rank); decisions.confirm(kiosk, id, "c" + rank);
            assertThat(reviewCount(id)).isEqualTo(1);
            var item = reviews.reviews("ALL", 0, 100).items().stream().filter(r -> r.get("attemptId").equals(id)).findFirst().orElseThrow();
            assertThat(item).containsEntry("kind", "CANDIDATE_SELECTION_MISMATCH").containsEntry("evidenceAvailable", true);
        }
    }
    @Test void deactivatedEnrollmentCommitsBlockedStateAndOneReview() {
        UUID id = capture();
        var membership = enrollments.findByStudent_IdAndCourseOffering_Id(student.getId(), offering.getId()).orElseThrow();
        enrollments.delete(membership);
        error("NOT_ENROLLED", () -> decisions.confirm(kiosk, id, "c1"));
        error("NOT_ENROLLED", () -> decisions.confirm(kiosk, id, "c1"));
        assertThat(row(id).state).isEqualTo("BLOCKED_NOT_ENROLLED"); assertThat(reviewCount(id)).isEqualTo(1);
        assertThat(attendance.findBySession_IdAndStudent_Id(classroom.getId(), student.getId())).isEmpty();
        assertThat(row(id).encryptedCandidates).isNull();
    }
    @Test void concurrentConfirmsWriteOnce() throws Exception {
        UUID id = capture(); var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Map<String, Object>> action = () -> { start.await(); return decisions.confirm(kiosk, id, "c2"); };
            var a = pool.submit(action); var b = pool.submit(action); start.countDown();
            assertThat(List.of(a.get(20, TimeUnit.SECONDS).get("replayed"), b.get(20, TimeUnit.SECONDS).get("replayed"))).containsExactlyInAnyOrder(false, true);
        }
        assertThat(historyCount(second.getId())).isEqualTo(1); assertThat(reviewCount(id)).isEqualTo(1);
    }
    void mark(Student student, AttendanceRecord.AttendanceStatus status) {
        var record = new AttendanceRecord(); record.setStudent(student); record.setSession(classroom); record.setStatus(status);
        record.setSource(AttendanceRecord.AttendanceSource.MANUAL); attendance.saveAndFlush(record);
    }
    @Test void existingMarksAreNeverOverwritten() {
        mark(student, AttendanceRecord.AttendanceStatus.PRESENT); UUID first = capture();
        assertThat(decisions.confirm(kiosk, first, "c1")).containsEntry("result", "ALREADY_RECORDED");
        assertThat(service.tx.<KioskEvidence>execute(s -> em.find(KioskEvidence.class, first))).isNull();
        mutateKiosk(k -> k.lastCaptureAt = null); mark(second, AttendanceRecord.AttendanceStatus.ABSENT); UUID next = capture();
        error("ATTENDANCE_LOCKED", () -> decisions.confirm(kiosk, next, "c2"));
        error("ATTENDANCE_LOCKED", () -> decisions.confirm(kiosk, next, "c2"));
        assertThat(historyCount(student.getId())).isZero(); assertThat(historyCount(second.getId())).isZero();
    }
    @Test void alreadyRecordedRankTwoKeepsEvidenceAndReview() {
        mark(second, AttendanceRecord.AttendanceStatus.LATE); UUID id = capture();
        assertThat(decisions.confirm(kiosk, id, "c2")).containsEntry("result", "ALREADY_RECORDED").containsEntry("attendanceStatus", "LATE");
        assertThat(reviewCount(id)).isEqualTo(1); assertThat(service.tx.<KioskEvidence>execute(s -> em.find(KioskEvidence.class, id))).isNotNull();
    }
    @Test void supersessionAndCancelErasePayloadsAndAreTerminal() {
        UUID id = capture(); mutateKiosk(k -> k.lastCaptureAt = null); UUID next = capture();
        assertThat(row(id).state).isEqualTo("SUPERSEDED"); assertThat(row(id).encryptedCapture).isNull();
        error("ATTEMPT_FINALIZED", () -> decisions.confirm(kiosk, id, "c1"));
        decisions.cancel(kiosk, next, "NOT_LISTED"); decisions.cancel(kiosk, next, "TIMEOUT");
        assertThat(row(next).state).isEqualTo("CANCELLED_NOT_LISTED"); assertThat(row(next).topStudentId).isEqualTo(student.getId());
    }
    @Test void timeWindowChecksAndPastLaunch() {
        mutateClass(c -> c.setStartTime(Instant.now().plusSeconds(1800)));
        error("KIOSK_WINDOW_NOT_OPEN", this::capture);
        mutateClass(c -> c.setEndTime(Instant.now().minusSeconds(1)));
        error("KIOSK_SESSION_CLOSED", this::capture);
        error("SESSION_NOT_LAUNCHABLE", () -> service.tx.execute(s -> service.launch(teacher.getId(), launch(10))));
    }
    @Test void closedSessionAtConfirmCommitsTerminalError() {
        UUID id = capture(); mutateClass(c -> c.setStatus(ClassroomSession.SessionStatus.CANCELLED));
        error("KIOSK_SESSION_CLOSED", () -> decisions.confirm(kiosk, id, "c1"));
        assertThat(row(id).state).isEqualTo("SESSION_CLOSED");
        error("KIOSK_SESSION_CLOSED", () -> decisions.confirm(kiosk, id, "c1"));
    }
    @Test void revokedConsentAndReenrollmentAreStale() {
        UUID id = capture(); vision.consent(student.getId(), new VisionService.Consent(false, false, ""));
        error("CANDIDATES_STALE", () -> decisions.confirm(kiosk, id, "c1"));
        mutateKiosk(k -> k.lastCaptureAt = null);
        // The next recognizer response must contain only eligible subjects.
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            var result = recognition("MATCH_CANDIDATE", 1);
            ((ObjectNode) result.path("faces").get(0)).putArray("candidates").addObject().put("studentId", second.getId().toString()).put("similarity", .8);
            return result;
        });
        UUID another = capture();
        vision.enroll(teacher.getId(), second.getId(), true, Collections.nCopies(7, image));
        error("CANDIDATES_STALE", () -> decisions.confirm(kiosk, another, "c1"));
    }
    @Test void invalidCandidateAndCrossKioskDoNotMutate() {
        UUID id = capture(); error("INVALID_CANDIDATE", () -> decisions.confirm(kiosk, id, "c9"));
        error("NOT_FOUND", () -> decisions.confirm(UUID.randomUUID(), id, "c1"));
        assertThat(row(id).state).isEqualTo("AWAITING_SELECTION");
    }
    @Test void expiryAndRetentionEraseOnlyPayloadAndEvidence() {
        UUID open = capture(); mutateAttempt(open, a -> a.expiresAt = Instant.now().minusSeconds(1));
        error("ATTEMPT_EXPIRED", () -> decisions.confirm(kiosk, open, "c1"));
        assertThat(row(open).encryptedCapture).isNull();
        mutateKiosk(k -> k.lastCaptureAt = null); UUID id = capture(); decisions.confirm(kiosk, id, "c2"); UUID review = reviewId(id);
        service.tx.executeWithoutResult(s -> em.find(KioskEvidence.class, id).deleteAfter = Instant.now().minusSeconds(1));
        mutateKiosk(k -> k.lastCaptureAt = null); UUID pending = capture(); mutateAttempt(pending, a -> a.expiresAt = Instant.now().minusSeconds(1));
        retention.purge();
        assertThat(row(id)).isNotNull(); assertThat(reviewCount(id)).isEqualTo(1);
        assertThat(row(pending).state).isEqualTo("EXPIRED"); assertThat(row(pending).encryptedCandidates).isNull();
        error("EVIDENCE_EXPIRED", () -> reviews.evidence(review));
    }
    @Test void adminReviewEndpointsAndResolutionIdempotency() throws Exception {
        UUID id = capture(); decisions.confirm(kiosk, id, "c2"); UUID review = reviewId(id);
        for (String path : List.of("/api/admin/kiosk-reviews", "/api/admin/kiosk-reviews/summary", "/api/admin/kiosk-reviews/" + review + "/evidence"))
            mvc.perform(get(path).with(browserSession(staffCookie))).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/kiosk-reviews/" + review + "/resolve").with(browserSession(staffCookie))
                .contentType("application/json").content("{\"resolution\":\"NO_ACTION\"}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/kiosk-reviews/" + review + "/evidence").with(browserSession(adminCookie)))
                .andExpect(status().isOk()).andExpect(content().bytes(image)).andExpect(header().string("Cache-Control", "no-store"));
        long before = ((Number) reviews.summary().get("open")).longValue();
        var resolved = reviews.resolve(admin.getId(), review, new KioskReviewService.Resolve("NO_ACTION", "Checked"));
        assertThat(reviews.resolve(admin.getId(), review, new KioskReviewService.Resolve("NO_ACTION", "Different note"))).isEqualTo(resolved);
        assertThat(((Number) reviews.summary().get("open")).longValue()).isEqualTo(before - 1);
        error("REVIEW_ALREADY_RESOLVED", () -> reviews.resolve(admin.getId(), review, new KioskReviewService.Resolve("VERIFIED_CORRECT", null)));
    }
    @Test void imageValidationLimitsAndSafeHttpProblems() throws Exception {
        error("INVALID_IMAGE", () -> captures.capture(kiosk, UUID.randomUUID(), new byte[]{1}));
        error("IMAGE_TOO_LARGE", () -> captures.capture(kiosk, UUID.randomUUID(), new byte[2097153]));
        capture();
        mvc.perform(multipart("/api/kiosk/device/captures").file(new MockMultipartFile("image", "test.jpg", "image/jpeg", image))
                .header("Idempotency-Key", UUID.randomUUID()).with(browserSession(cookie)))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("CAPTURE_RATE_LIMITED"))
                .andExpect(header().string("Retry-After", "2")).andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test void replayKeepsOriginalCollisionLabelAndNormalizedQualityAfterErasure() {
        service.tx.executeWithoutResult(s -> {
            var st = em.find(Student.class, second.getId()); st.setFirstName("Minji"); st.setLastName("Kang");
            var duplicate = em.find(Student.class, third.getId()); duplicate.setFirstName("Minji"); duplicate.setLastName("Kim");
        });
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            var result = recognition("UNCERTAIN", 1);
            var reasons = ((ObjectNode) result.path("faces").get(0)).putArray("qualityReasons");
            for (String reason : List.of("FACE_TOO_SMALL", "BLUR", "LIGHTING", "DUPLICATE_IDENTITY", "UNTRUSTED_PROVIDER_TEXT")) reasons.add(reason);
            return result;
        });
        UUID key = UUID.randomUUID(); var capture = captures.capture(kiosk, key, image);
        UUID id = (UUID) capture.body().get("attemptId");
        var cards = json.valueToTree(capture.body()).path("candidates");
        String expected = "Minji Kim ·" + student.getStudentNumber().substring(student.getStudentNumber().length() - 3);
        assertThat(cards.get(0).path("displayName").asText()).isEqualTo(expected);
        assertThat(cards.get(1).path("displayName").asText()).isEqualTo("Minji Kang");
        var confirmed = decisions.confirm(kiosk, id, "c1");
        service.tx.executeWithoutResult(s -> em.find(Student.class, student.getId()).setFirstName("Changed"));
        var replay = decisions.confirm(kiosk, id, "c1");
        assertThat(confirmed.get("displayName")).isEqualTo(expected);
        assertThat(replay.get("displayName")).isEqualTo(expected);
        assertThat(replay.get("processedAt")).isEqualTo(confirmed.get("processedAt"));
        var captureReplay = captures.capture(kiosk, key, image);
        assertThat(captureReplay.body().get("qualityReasons")).isEqualTo(List.of("FACE_TOO_SMALL", "BLUR", "LIGHTING", "DUPLICATE_IDENTITY", "OTHER"));
        assertThat(json.valueToTree(captureReplay.body()).path("candidates").isEmpty()).isTrue();
        assertThat(row(id).encryptedCandidates).isNull(); assertThat(row(id).encryptedCapture).isNull();
        assertThat(row(id).selectedDisplayName).isEqualTo(expected);
        assertThat(row(id).qualityReasons).doesNotContain("UNTRUSTED_PROVIDER_TEXT");
    }
    @Test void lowQualityReplayPreservesReasonsAndNoSelectedLabel() {
        when(gateway.recognize(any(), anyString())).thenReturn(recognition("LOW_QUALITY", 1));
        UUID key = UUID.randomUUID(); var original = captures.capture(kiosk, key, image);
        var replay = captures.capture(kiosk, key, image);
        assertThat(replay.body()).isEqualTo(original.body());
        var a = row((UUID) original.body().get("attemptId"));
        assertThat(a.selectedDisplayName).isNull(); assertThat(a.encryptedCandidates).isNull(); assertThat(a.encryptedCapture).isNull();
    }
    @Test void successfulStaffLoginEndsKioskButFailedLoginDoesNot() throws Exception {
        var password = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
        service.tx.executeWithoutResult(s -> em.find(Teacher.class, admin.getId()).setPasswordHash(password.encode("synthetic-test-password")));
        mvc.perform(post("/api/auth/login").with(browserSession(cookie)).contentType("application/json")
                .content(json.writeValueAsString(new io.github.huijingmen.softeng789.classroommonitoring.dto.LoginRequest(admin.getEmail(), "wrong"))))
                .andExpect(status().isUnauthorized());
        assertThat(auth.resolve(cookie)).isNotNull();
        var result = mvc.perform(post("/api/auth/login").with(browserSession(cookie)).contentType("application/json")
                .content(json.writeValueAsString(new io.github.huijingmen.softeng789.classroommonitoring.dto.LoginRequest(admin.getEmail(), "synthetic-test-password"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("ADMIN")).andReturn();
        assertThat(auth.resolve(cookie)).isNull();
        assertThat(auth.resolve(result.getResponse().getCookie("classlens-session").getValue()).role()).isEqualTo("ADMIN");
    }
    @Test void inFlightDuplicateDoesNotCallRecognizerTwiceOrHoldDatabaseTransaction() throws Exception {
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            entered.countDown(); assertThat(release.await(10, TimeUnit.SECONDS)).isTrue(); return recognition("MATCH_CANDIDATE", 1);
        });
        UUID key = UUID.randomUUID();
        try (var pool = Executors.newSingleThreadExecutor()) {
            var first = pool.submit(() -> captures.capture(kiosk, key, image));
            assertThat(entered.await(10, TimeUnit.SECONDS)).isTrue();
            try { error("RECOGNIZER_BUSY", () -> captures.capture(kiosk, key, image)); }
            finally { release.countDown(); }
            var result = first.get(10, TimeUnit.SECONDS);
            assertThat(captures.capture(kiosk, key, image).body()).isEqualTo(result.body());
        }
        verify(gateway, times(1)).recognize(any(), anyString());
    }
    @Test void malformedRecognizerResponseIsRejectedWithoutAnAttendanceWrite() {
        when(gateway.recognize(any(), anyString())).thenReturn(json.createObjectNode());
        error("RECOGNIZER_INVALID_RESPONSE", this::capture);
        assertThat(attendance.findBySession_IdAndStudent_Id(classroom.getId(), student.getId())).isEmpty();
    }
    @Test void responseAndEvidenceDiagnosticsNeverLogCandidateNamesOrImage() throws Exception {
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger("org.springframework.web");
        var originalLevel = logger.getLevel(); boolean originalAdditive = logger.isAdditive();
        var logs = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>(); logs.start();
        logger.addAppender(logs); logger.setAdditive(false); logger.setLevel(ch.qos.logback.classic.Level.TRACE);
        try {
            var result = mvc.perform(multipart("/api/kiosk/device/captures").file(new MockMultipartFile("image", "test.jpg", "image/jpeg", image))
                    .header("Idempotency-Key", UUID.randomUUID()).with(browserSession(cookie))).andExpect(status().isCreated()).andReturn();
            UUID id = UUID.fromString(json.readTree(result.getResponse().getContentAsString()).path("attemptId").asText());
            mvc.perform(post("/api/kiosk/device/attempts/" + id + "/confirm").with(browserSession(cookie))
                    .contentType("application/json").content("{\"candidateId\":\"c2\"}")).andExpect(status().isOk());
            mvc.perform(get("/api/admin/kiosk-reviews/" + reviewId(id) + "/evidence").with(browserSession(adminCookie))).andExpect(status().isOk());
            assertThat(logs.list).anySatisfy(event -> assertThat(event.getFormattedMessage()).contains("Writing ["));
            assertThat(logs.list).allSatisfy(event -> assertThat(event.getFormattedMessage())
                    .doesNotContain("Minji K.", "Alex L.", "Jamie P.", "Minji Kim", "Alex Lee",
                            Base64.getEncoder().encodeToString(image), "similarity", "templates", "[-1, -40, -1", "{-1, -40, -1"));
        } finally {
            logger.detachAppender(logs); logger.setLevel(originalLevel); logger.setAdditive(originalAdditive); logs.stop();
        }
    }


    @Test void launchValidationAndDisabledRecognitionHaveStableCodes() throws Exception {
        mvc.perform(post("/api/kiosk/sessions").with(browserSession(staffCookie)).contentType("application/json")
                .content(json.writeValueAsString(new KioskSessionService.Launch(classroom.getId(), campus.getId(), "Entrance", 10, false))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        error("VALIDATION_FAILED", () -> service.tx.execute(s -> service.launch(teacher.getId(),
                new KioskSessionService.Launch(classroom.getId(), campus.getId(), "Bad\nlabel", 61, true))));
        when(gateway.enabled()).thenReturn(false);
        error("RECOGNITION_UNAVAILABLE", () -> service.tx.execute(s -> service.launch(teacher.getId(), launch(10))));
        error("RECOGNITION_UNAVAILABLE", this::capture);
    }
    @Test void withdrawnEnrollmentAndInactiveStudentAreBlocked() {
        UUID first = capture();
        service.tx.executeWithoutResult(s -> enrollments.findByStudent_IdAndCourseOffering_Id(student.getId(), offering.getId())
                .orElseThrow().setStatus(CourseEnrollment.EnrollmentStatus.WITHDRAWN));
        error("NOT_ENROLLED", () -> decisions.confirm(kiosk, first, "c1"));
        assertThat(reviewCount(first)).isEqualTo(1);
        // The saved second candidate remains independently eligible until its account is deactivated.
        mutateKiosk(k -> k.lastCaptureAt = null);
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            var result = recognition("MATCH_CANDIDATE", 1);
            ((ObjectNode) result.path("faces").get(0)).putArray("candidates").addObject().put("studentId", second.getId().toString()).put("similarity", .8);
            return result;
        });
        UUID next = capture();
        service.tx.executeWithoutResult(s -> em.find(Student.class, second.getId()).setStatus("INACTIVE"));
        error("NOT_ENROLLED", () -> decisions.confirm(kiosk, next, "c1"));
        assertThat(reviewCount(next)).isEqualTo(1);
    }
    @Test void stoppingKioskDuringInferenceErasesCaptureAndReturnsUnauthorized() {
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            service.end(teacher.getId(), kiosk);
            return recognition("MATCH_CANDIDATE", 1);
        });
        assertThatThrownBy(this::capture).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode().value()).isEqualTo(401));
        var rows = service.tx.execute(s -> em.createQuery("select a from KioskAttempt a where a.kioskSessionId = :id", KioskAttempt.class)
                .setParameter("id", kiosk).getResultList());
        assertThat(rows).singleElement().satisfies(a -> {
            assertThat(a.state).isEqualTo("SESSION_CLOSED"); assertThat(a.encryptedCapture).isNull(); assertThat(a.encryptedCandidates).isNull();
        });
    }
    @Test void retirementExpiresKioskAndKeepsProcessingMetadata() {
        UUID id = capture(); mutateKiosk(k -> k.expiresAt = Instant.now().minusSeconds(1)); retention.purge();
        assertThat(auth.resolve(cookie)).isNull();
        assertThat(service.tx.<String>execute(s -> em.find(KioskSession.class, kiosk).endReason)).isEqualTo("EXPIRED");
        assertThat(row(id)).isNotNull();
    }
    @Test void zeroFacesNeverCreatesAbsenceAndForeignCandidatesAreRejected() {
        when(gateway.recognize(any(), anyString())).thenReturn(recognition("UNKNOWN", 0));
        capture(); assertThat(attendance.findBySession_IdAndStudent_Id(classroom.getId(), student.getId())).isEmpty();
        mutateKiosk(k -> k.lastCaptureAt = null);
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            var result = recognition("MATCH_CANDIDATE", 1);
            ((ObjectNode) result.path("faces").get(0).path("candidates").get(0)).put("studentId", UUID.randomUUID().toString());
            return result;
        });
        error("RECOGNIZER_INVALID_RESPONSE", this::capture);
    }


    @Test void anotherKeyAfterCooldownCannotSupersedeInFlightRecognition() throws Exception {
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            entered.countDown(); assertThat(release.await(15, TimeUnit.SECONDS)).isTrue();
            return recognition("MATCH_CANDIDATE", 1);
        });
        UUID key = UUID.randomUUID();
        try (var pool = Executors.newSingleThreadExecutor()) {
            var first = pool.submit(() -> captures.capture(kiosk, key, image));
            assertThat(entered.await(10, TimeUnit.SECONDS)).isTrue();
            try {
                // Advance the stored cooldown without relying on a wall-clock sleep.
                mutateKiosk(k -> k.lastCaptureAt = KioskTime.now().minusSeconds(3));
                error("RECOGNIZER_BUSY", () -> captures.capture(kiosk, UUID.randomUUID(), image));
                var reserved = service.tx.execute(s -> em.createQuery("select a from KioskAttempt a where a.kioskSessionId = :id", KioskAttempt.class)
                        .setParameter("id", kiosk).getResultList());
                assertThat(reserved).singleElement().satisfies(a -> {
                    assertThat(a.state).isEqualTo("AWAITING_SELECTION"); assertThat(a.encryptedCapture).isNotNull();
                });
            } finally { release.countDown(); }
            var result = first.get(10, TimeUnit.SECONDS);
            assertThat(result.body()).containsEntry("outcome", "CANDIDATES");
            verify(gateway, times(1)).recognize(any(), anyString());
            mutateKiosk(k -> k.lastCaptureAt = null);
            captures.capture(kiosk, UUID.randomUUID(), image);
            var replay = captures.capture(kiosk, key, image);
            assertThat(replay.body()).containsEntry("outcome", "CANDIDATES").containsEntry("state", "SUPERSEDED");
            assertThat(json.valueToTree(replay.body()).path("candidates").isEmpty()).isTrue();
        }
    }
    @Test void completionFailureDiscardsEncryptedReservationAndSameKeyCanRetry() {
        UUID key = UUID.randomUUID();
        doThrow(new ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Vision data cannot be decrypted."))
                .when(payloads).candidateSnapshot(any(), any());
        assertThatThrownBy(() -> captures.capture(kiosk, key, image)).isInstanceOf(ResponseStatusException.class);
        assertThat(service.tx.<Long>execute(s -> em.createQuery("select count(a) from KioskAttempt a where a.kioskSessionId = :id", Long.class)
                .setParameter("id", kiosk).getSingleResult())).isZero();
        doCallRealMethod().when(payloads).candidateSnapshot(any(), any());
        mutateKiosk(k -> k.lastCaptureAt = null);
        assertThat(captures.capture(kiosk, key, image).body()).containsEntry("outcome", "CANDIDATES");
    }
    @Test void failureAfterCandidateAssignmentRollsBackThenDiscardsReservation() throws Exception {
        doThrow(new IllegalStateException("Synthetic completion failure.")).when(payloads).candidateCards(any());
        mvc.perform(multipart("/api/kiosk/device/captures").file(new MockMultipartFile("image", "test.jpg", "image/jpeg", image))
                .header("Idempotency-Key", UUID.randomUUID()).with(browserSession(cookie)))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("RECOGNITION_UNAVAILABLE"));
        assertThat(service.tx.<Long>execute(s -> em.createQuery("select count(a) from KioskAttempt a where a.kioskSessionId = :id", Long.class)
                .setParameter("id", kiosk).getSingleResult())).isZero();
    }
    void deleteSyntheticStudent(Student st) {
        service.tx.executeWithoutResult(s -> {
            // Reproduce a committed database deletion during inference, independent of
            // Hibernate's managed fixture associations and lifecycle callbacks.
            em.createNativeQuery("delete from course_enrollments where student_id = :id")
                    .setParameter("id", st.getId()).executeUpdate();
            em.createNativeQuery("delete from students where id = :id")
                    .setParameter("id", st.getId()).executeUpdate();
            em.clear();
            assertThat(em.createQuery("select count(s) from Student s where s.id = :id", Long.class)
                    .setParameter("id", st.getId()).getSingleResult()).as("Deleted synthetic student").isZero();
        });
    }
    @Test void deletedCandidateDuringRecognitionIsSkipped() {
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            var result = recognition("MATCH_CANDIDATE", 1); deleteSyntheticStudent(student); return result;
        });
        var result = captures.capture(kiosk, UUID.randomUUID(), image);
        var cards = json.valueToTree(result.body()).path("candidates");
        assertThat(cards.size()).isEqualTo(2); assertThat(cards.get(0).path("displayName").asText()).isEqualTo("Alex L.");
        assertThat(result.body()).containsEntry("outcome", "CANDIDATES");
    }
    @Test void allDeletedCandidatesProduceTerminalNoCandidateWithErasedCapture() {
        when(gateway.recognize(any(), anyString())).thenAnswer(call -> {
            var result = recognition("MATCH_CANDIDATE", 1);
            for (var st : List.of(student, second, third)) deleteSyntheticStudent(st);
            return result;
        });
        UUID id = capture();
        assertThat(row(id).state).isEqualTo("NO_CANDIDATE");
        assertThat(row(id).encryptedCapture).isNull(); assertThat(row(id).encryptedCandidates).isNull();
    }
    @Test void adminViewRetainsSelectedStudentAndEvidenceWhenTopCandidateIsNull() {
        UUID id = capture(); decisions.confirm(kiosk, id, "c2");
        mutateAttempt(id, a -> a.topStudentId = null); // V10 performs this on deletion; exercised by KioskMigrationTest.
        deleteSyntheticStudent(student);
        var item = reviews.reviews("ALL", 0, 100).items().stream().filter(r -> id.equals(r.get("attemptId"))).findFirst().orElseThrow();
        assertThat(item).containsEntry("topCandidate", null).containsEntry("evidenceAvailable", true);
        assertThat(json.valueToTree(item).path("selectedStudent").path("id").asText()).isEqualTo(second.getId().toString());
        assertThat(reviews.evidence(reviewId(id)).bytes()).isEqualTo(image);
    }
    @Test void campusWithKioskHistoryReturns409EvenWithoutRooms() throws Exception {
        assertThat(classroom.getRoomEntity()).isNull();
        mvc.perform(delete("/api/admin/campuses/" + campus.getId()).with(browserSession(adminCookie)))
                .andExpect(status().isConflict());
        assertThatThrownBy(() -> campusService.deleteCampus(campus.getId())).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getReason()).contains("kiosk history"));
        service.end(teacher.getId(), kiosk);
        assertThatThrownBy(() -> campusService.deleteCampus(campus.getId())).isInstanceOf(ResponseStatusException.class);
        var empty = service.tx.execute(s -> { var c = new Campus(); c.setName(UUID.randomUUID().toString()); em.persist(c); return c.getId(); });
        campusService.deleteCampus(empty);
        assertThat(service.tx.<Campus>execute(s -> em.find(Campus.class, empty))).isNull();
    }
    @Test void retentionExpiredAttemptConfirmsAs410WithoutAStoredSelection() throws Exception {
        UUID id = capture(); mutateAttempt(id, a -> a.expiresAt = KioskTime.now().minusSeconds(1));
        retention.purge(); assertThat(row(id).selectedRank).isNull();
        mvc.perform(post("/api/kiosk/device/attempts/" + id + "/confirm").with(browserSession(cookie))
                .contentType("application/json").content("{\"candidateId\":\"c1\"}"))
                .andExpect(status().isGone()).andExpect(jsonPath("$.code").value("ATTEMPT_EXPIRED"));
        error("NOT_FOUND", () -> decisions.confirm(UUID.randomUUID(), id, "c1"));
        assertThat(row(id).encryptedCapture).isNull(); assertThat(row(id).encryptedCandidates).isNull();
    }
    @Test void eachHttpRequestResolvesKioskOnceAndNeverReusesAcrossRequests() throws Exception {
        clearInvocations(service);
        mvc.perform(get("/api/auth/me").with(browserSession(cookie))).andExpect(status().isOk());
        verify(service, times(1)).resolve(kiosk);
        mvc.perform(get("/api/kiosk/device").with(browserSession(cookie))).andExpect(status().isOk());
        verify(service, times(2)).resolve(kiosk);
        service.end(teacher.getId(), kiosk);
        mvc.perform(get("/api/kiosk/device").with(browserSession(cookie))).andExpect(status().isUnauthorized());
        assertThat(KioskRequestAuthentication.get("unused-digest")).isNull();
    }
    @Test void readOnlyAuthenticationDoesNotWaitForTheKioskWriteLock() throws Exception {
        var locked = new CountDownLatch(1); var release = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var writer = pool.submit(() -> service.tx.executeWithoutResult(s -> {
                em.find(KioskSession.class, kiosk, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
                locked.countDown();
                try { assertThat(release.await(15, TimeUnit.SECONDS)).isTrue(); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
            }));
            assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue();
            try { assertThat(pool.submit(() -> auth.resolve(cookie)).get(3, TimeUnit.SECONDS)).isNotNull(); }
            finally { release.countDown(); }
            writer.get(10, TimeUnit.SECONDS);
        }
    }
    @Test void optionsBatchProfilesAndReturnTenDistinctScopedRecentLabels() {
        service.tx.executeWithoutResult(s -> {
            for (int i = 0; i < 15; i++) {
                var c = new ClassroomSession(); c.setCourse("Synthetic option"); c.setRoom("Room");
                c.setCourseOffering(em.find(CourseOffering.class, offering.getId())); c.setTeacher(em.find(Teacher.class, teacher.getId()));
                c.setStartTime(classroom.getStartTime()); c.setEndTime(classroom.getEndTime()); c.setDate(classroom.getDate()); em.persist(c);
                var k = new KioskSession(); k.id = UUID.randomUUID(); k.sessionId = c.getId(); k.campusId = campus.getId();
                k.locationLabel = "Location " + i; k.launchedBy = teacher.getId(); k.launchedAt = KioskTime.now().plusSeconds(i);
                k.expiresAt = classroom.getEndTime(); em.persist(k);
            }
        });
        var stats = entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        stats.setStatisticsEnabled(true); stats.clear();
        try {
            var result = json.valueToTree(service.options(teacher.getId(), classroom.getDate(), campus.getId()));
            assertThat(result.path("sessions").size()).isEqualTo(16);
            for (var session : result.path("sessions")) assertThat(session.path("faceReadyCount").asInt()).isEqualTo(3);
            assertThat(result.path("recentLocations").size()).isEqualTo(10);
            assertThat(result.path("recentLocations").get(0).asText()).isEqualTo("Location 14");
            assertThat(stats.getPrepareStatementCount()).isLessThanOrEqualTo(8);
        } finally { stats.setStatisticsEnabled(false); }
        assertThat(json.valueToTree(service.options(other.getId(), classroom.getDate(), campus.getId())).path("recentLocations").isEmpty()).isTrue();
        assertThat(json.valueToTree(service.options(admin.getId(), classroom.getDate(), campus.getId())).path("recentLocations").size()).isEqualTo(10);
    }

}