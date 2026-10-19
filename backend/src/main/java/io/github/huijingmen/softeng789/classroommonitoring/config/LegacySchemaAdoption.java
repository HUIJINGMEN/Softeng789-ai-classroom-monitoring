package io.github.huijingmen.softeng789.classroommonitoring.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;
import org.flywaydb.core.Flyway;

/** Explicit one-time adoption only. Never called by application startup or normal migration. */
public final class LegacySchemaAdoption {
    private LegacySchemaAdoption() { }
    public static void baseline(Flyway flyway) {
        try (var connection = flyway.getConfiguration().getDataSource().getConnection()) {
            verify(connection);
        } catch (SQLException exception) { throw new IllegalStateException("Could not verify baseline target.", exception); }
        flyway.baseline(); // Records version 1 only. Does not run V1 or any historical correction DML.
    }
    static void verify(java.sql.Connection connection) throws SQLException {
        try (var statement = connection.createStatement()) {
            if (!"PostgreSQL".equals(connection.getMetaData().getDatabaseProductName()))
                throw new IllegalStateException("Baseline adoption requires PostgreSQL.");
            statement.execute("SET search_path TO public");
            try (var history = statement.executeQuery("SELECT to_regclass('public.flyway_schema_history')")) {
                history.next();
                if (history.getString(1) != null) throw new IllegalStateException("Already versioned; use migrate/validate, not baseline.");
            }
            Set<String> expected = new HashSet<>(resource("/db/legacy-schema-contract.txt").lines()
                    .map(LegacySchemaAdoption::canonical).toList());
            Set<String> actual = new HashSet<>();
            try (var rows = statement.executeQuery(resource("/db/legacy-schema-contract.sql"))) {
                while (rows.next()) actual.add(canonical(rows.getString(1)));
            }
            expected.removeAll(actual);
            if (!expected.isEmpty()) throw new IllegalStateException("Legacy schema does not match V1; adoption refused. Missing contract entries: "
                    + String.join("; ", new java.util.TreeSet<>(expected)));
            for (String query : new String[] {
                    "SELECT count(*) FROM (SELECT 1 FROM student_reports WHERE published_at IS NULL GROUP BY student_id,created_by_id,scope_key HAVING count(*)>1) d",
                    "SELECT count(*) FROM (SELECT 1 FROM class_reports WHERE finalized_at IS NULL GROUP BY course_offering_id,created_by_id,scope_key HAVING count(*)>1) d",
                    "SELECT count(*) FROM (SELECT 1 FROM overall_reports WHERE finalized_at IS NULL GROUP BY created_by_id,scope_key HAVING count(*)>1) d"}) {
                try (var duplicates = statement.executeQuery(query)) {
                    duplicates.next();
                    if (duplicates.getLong(1) != 0) throw new IllegalStateException("Duplicate open drafts require manual reconciliation before adoption; nothing was deleted.");
                }
            }
        }
    }
    static String canonical(String definition) {
        // pg_dump/restore can move varchar->text casts from an enum array onto each literal.
        // Normalize only equivalent string casts and redundant literal/array parentheses.
        // Keep operators, identifiers, values, numeric casts, FK actions and predicates intact.
        String value = definition.replaceAll("::(?:character varying|text)(?:\\[\\])?", "");
        String previous;
        do {
            previous = value;
            value = value.replaceAll("\\(('(?:''|[^'])*')\\)", "$1")
                    .replaceAll("\\((ARRAY\\[[^\\]]*\\])\\)", "$1");
        } while (!previous.equals(value));
        return value;
    }
    static String resource(String path) {
        try (var input = LegacySchemaAdoption.class.getResourceAsStream(path)) {
            if (input == null) throw new IllegalStateException("Missing schema contract.");
            return new String(input.readAllBytes(), StandardCharsets.UTF_8).trim();
        } catch (IOException exception) { throw new IllegalStateException("Cannot read schema contract.", exception); }
    }
}
