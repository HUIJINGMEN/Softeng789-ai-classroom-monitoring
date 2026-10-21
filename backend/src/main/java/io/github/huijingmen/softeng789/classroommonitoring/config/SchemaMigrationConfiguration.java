package io.github.huijingmen.softeng789.classroommonitoring.config;

import javax.sql.DataSource;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/** PostgreSQL migrations own runtime DDL. H2 exists only on the test classpath. */
@Configuration
public class SchemaMigrationConfiguration {
    @Bean
    FlywayMigrationStrategy schemaMigrations(DataSource dataSource, Environment environment) {
        return flyway -> {
            try (var connection = dataSource.getConnection()) {
                String product = connection.getMetaData().getDatabaseProductName();
                boolean production = environment.matchesProfiles("production", "prod");
                if ("H2".equals(product) && !production
                        && "create-drop".equals(environment.getProperty("spring.jpa.hibernate.ddl-auto"))) return;
                if (!"PostgreSQL".equals(product)) throw new IllegalStateException("Runtime migrations require PostgreSQL.");
            } catch (java.sql.SQLException exception) { throw new IllegalStateException("Cannot verify migration target.", exception); }
            flyway.migrate(); // Non-empty, unadopted databases and checksum drift fail startup.
        };
    }
}
