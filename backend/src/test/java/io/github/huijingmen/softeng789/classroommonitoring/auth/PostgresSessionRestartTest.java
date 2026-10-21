package io.github.huijingmen.softeng789.classroommonitoring.auth;

import io.github.huijingmen.softeng789.classroommonitoring.ClassroomMonitoringApplication;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks.*;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Runs only in the disposable PostgreSQL schema harness, never against the installed database. */
@EnabledIfSystemProperty(named = "schemaCheck.url", matches = "jdbc:postgresql://127\\.0\\.0\\.1:.*classlens_schema_.*")
class PostgresSessionRestartTest {
    private ConfigurableApplicationContext start() {
        return new SpringApplicationBuilder(ClassroomMonitoringApplication.class, AccountLinkTestInbox.class).run(
                "--spring.profiles.active=postgres", "--server.port=0", "--debug=false",
                "--spring.main.banner-mode=off", "--logging.level.root=WARN",
                "--logging.level.org.hibernate.SQL=OFF", "--logging.level.org.hibernate.orm.jdbc.bind=OFF",
                "--spring.datasource.url=" + System.getProperty("schemaCheck.url"),
                "--spring.datasource.username=postgres", "--spring.datasource.password=schema-test-only",
                "--spring.jpa.hibernate.ddl-auto=validate", "--app.bootstrap.admin-password=",
                "--app.report-email.provider=demo", "--app.invoice-email.provider=demo");
    }

    private URI endpoint(ConfigurableApplicationContext context, String path) {
        return URI.create("http://127.0.0.1:" + context.getEnvironment().getProperty("local.server.port") + path);
    }

    private String proof(HttpClient browser, ConfigurableApplicationContext context) throws Exception {
        var response = browser.send(HttpRequest.newBuilder(endpoint(context, "/api/auth/csrf")).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        return context.getBean(ObjectMapper.class).readTree(response.body()).get("token").asText();
    }

    @Test void loginSurvivesApplicationReconstructionAndLogoutRemainsRevokedAfterAnotherRestart() throws Exception {
        var cookieStore = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        var browser = HttpClient.newBuilder().cookieHandler(cookieStore).build();
        UUID accountId;
        String originalCredential;
        String resetProof;
        String budgetKey = UUID.randomUUID().toString().replace("-", "").repeat(2);
        try (var first = start()) {
            verifyConcurrentBudget(first, budgetKey);
            String key = UUID.randomUUID().toString();
            Teacher teacher = new Teacher(); teacher.setStaffNumber(key); teacher.setEmail(key + "@restart.test");
            teacher.setName("Restart Test"); teacher.setRole("ADMIN");
            teacher.setPasswordHash(first.getBean(PasswordEncoder.class).encode("restart-test-password"));
            teacher = first.getBean(TeacherRepository.class).saveAndFlush(teacher); accountId = teacher.getId();
            verifyConcurrentReportPreparation(first, teacher);
            var login = browser.send(HttpRequest.newBuilder(endpoint(first, "/api/auth/login"))
                    .header("X-CSRF-TOKEN", proof(browser, first)).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"" + teacher.getEmail()
                            + "\",\"password\":\"restart-test-password\"}")).build(), HttpResponse.BodyHandlers.ofString());
            assertThat(login.statusCode()).isEqualTo(200);
            assertThat(login.body()).doesNotContain("\"token\"");
            originalCredential = cookieStore.getCookieStore().getCookies().stream()
                    .filter(cookie -> cookie.getName().equals("classlens-session")).findFirst().orElseThrow().getValue();
            first.getBean(AccountLinkRequests.class).request(teacher.getEmail(), AccountLinkPurpose.PASSWORD_RESET);
            first.getBean(AccountLinkWorker.class).deliverNext();
            resetProof = first.getBean(AccountLinkTestInbox.Inbox.class).take(teacher.getEmail());
        }
        try (var second = start()) {
            assertThat(second.getBean(AccountLinkProofs.class).inspect(resetProof).purpose()).isEqualTo(AccountLinkPurpose.PASSWORD_RESET);
            assertThatThrownBy(() -> second.getBean(LoginAttemptStore.class).reserve(budgetKey, Instant.now(),
                    3, Duration.ofMinutes(10), Duration.ofMinutes(15)))
                    .isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class,
                            blocked -> assertThat(blocked.getStatusCode()).isEqualTo(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS));
            var me = browser.send(HttpRequest.newBuilder(endpoint(second, "/api/auth/me")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            assertThat(me.statusCode()).isEqualTo(200); assertThat(me.body()).contains(accountId.toString());
            var logout = browser.send(HttpRequest.newBuilder(endpoint(second, "/api/auth/logout"))
                    .header("X-CSRF-TOKEN", proof(browser, second)).POST(HttpRequest.BodyPublishers.noBody()).build(),
                    HttpResponse.BodyHandlers.ofString());
            assertThat(logout.statusCode()).isEqualTo(204);
        }
        try (var third = start()) {
            var rejected = HttpClient.newHttpClient().send(HttpRequest.newBuilder(endpoint(third, "/api/auth/me"))
                    .header("Cookie", "classlens-session=" + originalCredential).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertThat(rejected.statusCode()).isEqualTo(401);
            verifyConcurrentReset(third, resetProof);
        }
    }

    private void verifyConcurrentReportPreparation(ConfigurableApplicationContext context, Teacher owner) throws Exception {
        var students = context.getBean(io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository.class);
        String key = UUID.randomUUID().toString().replace("-", "");
        var student = new io.github.huijingmen.softeng789.classroommonitoring.entity.Student();
        student.setStudentNumber(key);student.setUniversityEmail(key+"@report.test");student.setFirstName("Report");student.setLastName("Concurrency");
        student.setCourse("TEST");student.setSeat("1");student.setProgramme("");student=students.saveAndFlush(student);
        var courses=context.getBean(io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository.class);
        var course=new io.github.huijingmen.softeng789.classroommonitoring.entity.Course();course.setCode(key);course.setName("Concurrency");course=courses.saveAndFlush(course);
        var offerings=context.getBean(io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository.class);
        var offering=new io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering();offering.setCourse(course);offering.setOfferingCode(key);
        offering.setAcademicTerm("2026");offering.getTeachers().add(owner);offering=offerings.saveAndFlush(offering);
        var enrolment=new io.github.huijingmen.softeng789.classroommonitoring.entity.CourseEnrollment();enrolment.setStudent(student);enrolment.setCourseOffering(offering);
        context.getBean(io.github.huijingmen.softeng789.classroommonitoring.repository.CourseEnrollmentRepository.class).saveAndFlush(enrolment);
        var today=java.time.LocalDate.now(io.github.huijingmen.softeng789.classroommonitoring.service.SessionClock.AUCKLAND);
        var studentScope=new io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.Scope(student.getId(),today.minusDays(7),today,java.util.List.of(offering.getId()));
        var classScope=new io.github.huijingmen.softeng789.classroommonitoring.reports.ClassReportModels.Scope(offering.getId(),today.minusDays(7),today);
        var overallScope=new io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Scope(today.minusDays(7),today,
                io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.Audience.INTERNAL,java.util.List.of(offering.getId()));
        var studentService=context.getBean(io.github.huijingmen.softeng789.classroommonitoring.reports.StudentReportService.class);
        var classService=context.getBean(io.github.huijingmen.softeng789.classroommonitoring.reports.ClassReportService.class);
        var overallService=context.getBean(io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportService.class);
        samePreparedId(()->studentService.prepare(studentScope,owner.getId()).id());
        samePreparedId(()->classService.prepare(classScope,owner.getId()).id());
        samePreparedId(()->overallService.prepare(overallScope,owner.getId()).id());
    }
    private void samePreparedId(java.util.concurrent.Callable<UUID> prepare) throws Exception {
        var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<UUID> concurrent=()->{assertThat(start.await(5,TimeUnit.SECONDS)).isTrue();return prepare.call();};
            var first=executor.submit(concurrent);var second=executor.submit(concurrent);start.countDown();
            assertThat(first.get(15,TimeUnit.SECONDS)).isEqualTo(second.get(15,TimeUnit.SECONDS));
        }
    }
    private void verifyConcurrentReset(ConfigurableApplicationContext context, String proof) throws Exception {
        var reset = context.getBean(AccountPasswordReset.class);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Boolean> redeem = () -> {
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                try { reset.reset(proof, "restart-reset-password"); return true; }
                catch (org.springframework.web.server.ResponseStatusException used) { return false; }
            };
            var first = executor.submit(redeem); var second = executor.submit(redeem); start.countDown();
            assertThat(java.util.List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
        }
    }

    private void verifyConcurrentBudget(ConfigurableApplicationContext context, String digest) throws Exception {
        var firstOwner = context.getBean(LoginAttemptStore.class);
        var secondOwner = new LoginAttemptStore(context.getBean(LoginAttemptRepository.class),
                context.getBean(org.springframework.transaction.PlatformTransactionManager.class));
        var start = new CountDownLatch(1);
        var ready = new CountDownLatch(12);
        try (var executor = Executors.newFixedThreadPool(12)) {
            var results = new ArrayList<Future<Boolean>>();
            for (int i = 0; i < 12; i++) {
                var owner = i % 2 == 0 ? firstOwner : secondOwner;
                results.add(executor.submit(() -> {
                    ready.countDown();
                    assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
                    try {
                        owner.reserve(digest, Instant.now(), 3, Duration.ofMinutes(10), Duration.ofMinutes(15));
                        return true;
                    } catch (org.springframework.web.server.ResponseStatusException rejected) {
                        assertThat(rejected.getStatusCode()).isEqualTo(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS);
                        return false;
                    }
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            int admitted = 0;
            for (var result : results) if (result.get(20, TimeUnit.SECONDS)) admitted++;
            assertThat(admitted).isEqualTo(3);
        }
    }
}
