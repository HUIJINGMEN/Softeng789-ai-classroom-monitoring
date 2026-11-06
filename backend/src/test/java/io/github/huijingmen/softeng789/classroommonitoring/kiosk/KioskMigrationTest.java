package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import java.nio.file.*;
import java.sql.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

/** Executes the actual V10 against a minimal reproduction of V9's destructive FK.
 * H2 verifies referential behavior here; full PostgreSQL Flyway validation is separate. */
class KioskMigrationTest {
    @Test
    @org.junit.jupiter.api.condition.EnabledIfSystemProperty(named = "schemaCheck.url",
            matches = "jdbc:postgresql://127\\.0\\.0\\.1:.*classlens_schema_.*")
    void postgresPreservesConfirmedAttemptReviewAndEvidenceAfterTopCandidateDeletion() throws Exception {
        String url = System.getProperty("schemaCheck.url");
        org.flywaydb.core.Flyway.configure().dataSource(url, "postgres", "schema-test-only")
                .defaultSchema("public").cleanDisabled(true).load().migrate();
        try (var c = DriverManager.getConnection(url, "postgres", "schema-test-only")) {
            c.setAutoCommit(false);
            try (var q = c.createStatement()) {
                UUID top = UUID.randomUUID(), selected = UUID.randomUUID(), campus = UUID.randomUUID(),
                        session = UUID.randomUUID(), kiosk = UUID.randomUUID(), attempt = UUID.randomUUID();
                for (UUID student : new UUID[]{top, selected})
                    q.executeUpdate("insert into students(id,student_number,university_email,first_name,last_name,course,seat) values ('"
                            + student + "','" + student.toString().replace("-", "") + "','" + student
                            + "@example.test','Synthetic','Student','TEST','A1')");
                q.executeUpdate("insert into campuses(id,name) values ('" + campus + "','Synthetic kiosk migration campus')");
                q.executeUpdate("insert into classroom_sessions(id,course_name,room,session_date,start_time,end_time) values ('"
                        + session + "','TEST','TEST',current_date,now(),now()+interval '1 hour')");
                q.executeUpdate("insert into kiosk_sessions(id,session_id,campus_id,location_label,launched_at,expires_at) values ('"
                        + kiosk + "','" + session + "','" + campus + "','TEST',now(),now()+interval '1 hour')");
                q.executeUpdate("insert into kiosk_attempts(id,kiosk_session_id,session_id,campus_id,location_label,"
                        + "request_key,request_digest,state,candidate_count,top_student_id,selected_student_id,selected_rank,captured_at,expires_at,processed_at)"
                        + " values ('" + attempt + "','" + kiosk + "','" + session + "','" + campus
                        + "','TEST','" + UUID.randomUUID() + "','synthetic','CONFIRMED',2,'" + top + "','" + selected + "',2,now(),now()+interval '2 minutes',now())");
                q.executeUpdate("insert into kiosk_review_items(id,attempt_id,kind,state,created_at) values ('"
                        + UUID.randomUUID() + "','" + attempt + "','CANDIDATE_SELECTION_MISMATCH','OPEN',now())");
                q.executeUpdate("insert into kiosk_evidence(attempt_id,content_type,encrypted_image,captured_at,delete_after) values ('"
                        + attempt + "','image/jpeg','synthetic-not-an-image',now(),now()+interval '30 days')");
                q.executeUpdate("delete from students where id = '" + top + "'");
                try (var rows = q.executeQuery("select a.top_student_id,a.selected_student_id,a.state,r.state,e.encrypted_image"
                        + " from kiosk_attempts a join kiosk_review_items r on r.attempt_id=a.id"
                        + " join kiosk_evidence e on e.attempt_id=a.id where a.id='" + attempt + "'")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getObject(1)).isNull();
                    assertThat(rows.getObject(2, UUID.class)).isEqualTo(selected);
                    assertThat(rows.getString(3)).isEqualTo("CONFIRMED");
                    assertThat(rows.getString(4)).isEqualTo("OPEN");
                    assertThat(rows.getString(5)).isEqualTo("synthetic-not-an-image");
                }
            } finally { c.rollback(); }
        }
    }

    @Test void removingOnlyTheTopCandidatePreservesSelectedStudentsHistory() throws Exception {
        try (var c = DriverManager.getConnection("jdbc:h2:mem:kiosk-v10-" + UUID.randomUUID() + ";MODE=PostgreSQL", "sa", "");
             var q = c.createStatement()) {
            q.execute("create table students(id uuid primary key)");
            q.execute("create table kiosk_sessions(id uuid primary key, campus_id uuid)");
            q.execute("create table kiosk_attempts(id uuid primary key, campus_id uuid, top_student_id uuid, selected_student_id uuid references students(id) on delete cascade, "
                    + "constraint kiosk_attempts_top_student_id_fkey foreign key(top_student_id) references students(id) on delete cascade)");
            q.execute("create table kiosk_review_items(id uuid primary key, attempt_id uuid references kiosk_attempts(id) on delete cascade)");
            q.execute("create table kiosk_evidence(attempt_id uuid primary key references kiosk_attempts(id) on delete cascade)");
            UUID top = UUID.randomUUID(), selected = UUID.randomUUID(), attempt = UUID.randomUUID();
            q.execute("insert into students values ('" + top + "'), ('" + selected + "')");
            q.execute("insert into kiosk_attempts values ('" + attempt + "', null, '" + top + "', '" + selected + "')");
            q.execute("insert into kiosk_review_items values ('" + UUID.randomUUID() + "', '" + attempt + "')");
            q.execute("insert into kiosk_evidence values ('" + attempt + "')");
            String migration = Files.readString(Path.of("src/main/resources/db/migration/V10__kiosk_review_fixes.sql"));
            for (String sql : migration.split(";")) if (!sql.isBlank()) q.execute(sql);
            q.execute("delete from students where id = '" + top + "'");
            try (var rows = q.executeQuery("select top_student_id, selected_student_id from kiosk_attempts")) {
                assertThat(rows.next()).isTrue(); assertThat(rows.getObject(1)).isNull(); assertThat(rows.getObject(2, UUID.class)).isEqualTo(selected);
            }
            for (String table : new String[]{"kiosk_attempts", "kiosk_review_items", "kiosk_evidence"})
                try (var rows = q.executeQuery("select count(*) from " + table)) { rows.next(); assertThat(rows.getInt(1)).as(table).isEqualTo(1); }
        }
    }
}
