package io.github.huijingmen.softeng789.classroommonitoring.config;

import org.flywaydb.core.Flyway;

/** Known local pre-Flyway DDL alignment only. Full contract validation precedes commit. */
public final class LegacySchemaAlignment {
    private LegacySchemaAlignment() { }
    public static void align(Flyway flyway) {
        try (var connection = flyway.getConfiguration().getDataSource().getConnection()) {
            connection.setAutoCommit(false);
            try (var sql = connection.createStatement()) {
                sql.execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
                try (var history = sql.executeQuery("SELECT to_regclass('public.flyway_schema_history')")) {
                    history.next();
                    if (history.getString(1) != null) throw new IllegalStateException("Already versioned; use a versioned migration instead.");
                }
                sql.execute(LegacySchemaAdoption.resource("/db/adoption/align-local-v1.sql"));
                LegacySchemaAdoption.verify(connection);
                connection.commit();
            } catch (RuntimeException | java.sql.SQLException exception) {
                connection.rollback(); throw exception;
            }
        } catch (java.sql.SQLException exception) {
            throw new IllegalStateException("Legacy alignment failed; transaction rolled back.", exception);
        }
    }
}
