package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.ClassroomMonitoringApplication;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateStaffRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.TeacherRepository;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.http.HttpStatus.FORBIDDEN;

/** Real row-lock semantics, only on the disposable PostgreSQL harness databases. */
@EnabledIfSystemProperty(named = "schemaCheck.url", matches = "jdbc:postgresql://127\\.0\\.0\\.1:.*classlens_schema_.*")
class PostgresStaffAuthorizationTest {
    @Test void deactivationAndPostInferenceAuthorizationSerializeInBothOrders() throws Exception {
        try (var context = start()) {
            var teachers = context.getBean(TeacherRepository.class);
            var access = context.getBean(TeacherScopeSupport.class);
            var admin = context.getBean(AdminService.class);
            var transactions = new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
            var jdbc = context.getBean(JdbcTemplate.class);
            var caller = activeTeacher(teachers);
            assertThatThrownBy(() -> access.requireCallerForWrite(caller.getId()))
                    .isInstanceOf(IllegalTransactionStateException.class);

            // Once authorized, the account cannot change until the caller's write transaction ends.
            var authorized = new CountDownLatch(1);
            var releaseWrite = new CountDownLatch(1);
            try (var pool = Executors.newFixedThreadPool(2)) {
                try {
                    var write = pool.submit(() -> transactions.executeWithoutResult(status -> {
                        access.requireCallerForWrite(caller.getId());
                        authorized.countDown();
                        await(releaseWrite);
                    }));
                    await(authorized);
                    var deactivate = pool.submit(() -> admin.updateStaffStatus(caller.getId(),
                            new UpdateStaffRequest("DEACTIVATED"), UUID.randomUUID()));
                    awaitBlockedTeacherQuery(jdbc);
                    assertThat(deactivate.isDone()).isFalse();
                    releaseWrite.countDown();
                    write.get(10, TimeUnit.SECONDS);
                    deactivate.get(10, TimeUnit.SECONDS);
                } finally {
                    releaseWrite.countDown();
                }
            }
            assertThat(teachers.findById(caller.getId()).orElseThrow().getStatus()).isEqualTo("DEACTIVATED");

            // If deactivation owns the row first, authorization waits, then observes the new status.
            var other = activeTeacher(teachers);
            var deactivated = new CountDownLatch(1);
            var releaseDeactivation = new CountDownLatch(1);
            try (var pool = Executors.newFixedThreadPool(2)) {
                try {
                    var deactivate = pool.submit(() -> transactions.executeWithoutResult(status -> {
                        admin.updateStaffStatus(other.getId(), new UpdateStaffRequest("DEACTIVATED"), UUID.randomUUID());
                        teachers.flush();
                        deactivated.countDown();
                        await(releaseDeactivation);
                    }));
                    await(deactivated);
                    var write = pool.submit(() -> {
                        assertThatThrownBy(() -> transactions.executeWithoutResult(status -> access.requireCallerForWrite(other.getId())))
                                .isInstanceOfSatisfying(ResponseStatusException.class,
                                        error -> assertThat(error.getStatusCode()).isEqualTo(FORBIDDEN));
                    });
                    awaitBlockedTeacherQuery(jdbc);
                    assertThat(write.isDone()).isFalse();
                    releaseDeactivation.countDown();
                    deactivate.get(10, TimeUnit.SECONDS);
                    write.get(10, TimeUnit.SECONDS);
                } finally {
                    releaseDeactivation.countDown();
                }
            }
        }
    }

    private Teacher activeTeacher(TeacherRepository teachers) {
        String key = UUID.randomUUID().toString();
        var caller = new Teacher(); caller.setName("Authorization lock test"); caller.setStaffNumber(key);
        caller.setEmail(key + "@authorization.test"); caller.setRole("TEACHER"); caller.setStatus("ACTIVE");
        return teachers.saveAndFlush(caller);
    }

    private static void await(CountDownLatch signal) {
        try {
            assertThat(signal.await(10, TimeUnit.SECONDS)).as("concurrent transaction reached its checkpoint").isTrue();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new AssertionError("Interrupted while waiting for concurrent transaction", interrupted);
        }
    }

    private void awaitBlockedTeacherQuery(JdbcTemplate jdbc) {
        Awaitility.await().atMost(Duration.ofSeconds(5)).pollInterval(Duration.ofMillis(25))
                .until(() -> Boolean.TRUE.equals(jdbc.queryForObject("""
                    select exists (select 1 from pg_stat_activity
                    where datname = current_database() and wait_event_type = 'Lock'
                      and cardinality(pg_blocking_pids(pid)) > 0 and query like '%teachers%')
                    """, Boolean.class)));
    }

    private ConfigurableApplicationContext start() {
        return new SpringApplicationBuilder(ClassroomMonitoringApplication.class).run(
                "--spring.profiles.active=postgres", "--server.port=0", "--debug=false",
                "--spring.main.banner-mode=off", "--logging.level.root=WARN",
                "--logging.level.org.hibernate.SQL=OFF", "--logging.level.org.hibernate.orm.jdbc.bind=OFF",
                "--spring.datasource.url=" + System.getProperty("schemaCheck.url"),
                "--spring.datasource.username=postgres", "--spring.datasource.password=schema-test-only",
                "--spring.jpa.hibernate.ddl-auto=validate", "--app.bootstrap.admin-password=",
                "--app.report-email.provider=demo", "--app.invoice-email.provider=demo");
    }
}
