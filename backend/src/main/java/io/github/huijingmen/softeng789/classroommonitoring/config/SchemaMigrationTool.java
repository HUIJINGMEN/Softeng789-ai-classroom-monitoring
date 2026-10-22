package io.github.huijingmen.softeng789.classroommonitoring.config;

import java.nio.file.Files;
import java.nio.file.Path;
import org.flywaydb.core.Flyway;

/** Operator command without Spring startup, bootstrap accounts, jobs, SMTP or business services. */
public final class SchemaMigrationTool {
    private SchemaMigrationTool() { }
    public static void main(String[] args) throws java.io.IOException {
        if (args.length != 1 || !java.util.Set.of("migrate", "adopt-v1", "align-local-v1").contains(args[0]))
            throw new IllegalArgumentException("Use migrate, adopt-v1 or align-local-v1.");
        var flyway = Flyway.configure().dataSource(required("DATABASE_URL"), required("POSTGRES_USER"),
                required("POSTGRES_PASSWORD")).defaultSchema("public").baselineVersion("1")
                .baselineOnMigrate(false).validateOnMigrate(true).cleanDisabled(true).outOfOrder(false).load();
        if (!"migrate".equals(args[0])) {
            Path backup = Path.of(required("SCHEMA_BACKUP_PATH"));
            if (!Files.isRegularFile(backup) || Files.size(backup) == 0)
                throw new IllegalStateException("A verified non-empty backup file is required before adoption.");
            if ("align-local-v1".equals(args[0])) LegacySchemaAlignment.align(flyway);
            else LegacySchemaAdoption.baseline(flyway);
        } else flyway.migrate();
    }
    private static String required(String key) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) throw new IllegalStateException("Missing environment setting: " + key);
        return value;
    }
}
