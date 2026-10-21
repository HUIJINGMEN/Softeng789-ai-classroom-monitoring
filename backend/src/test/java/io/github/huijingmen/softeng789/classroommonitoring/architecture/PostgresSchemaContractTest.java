package io.github.huijingmen.softeng789.classroommonitoring.architecture;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;

/** Mapping validation only: no application services, seed runners, mailers or scheduled jobs are started. */
@EnabledIfSystemProperty(named = "schemaCheck.url", matches = "jdbc:postgresql://127\\.0\\.0\\.1:.*classlens_schema_.*")
class PostgresSchemaContractTest {
    @Test
    void entityMappingsMatchTheMigratedDatabase() {
        var factory = new LocalContainerEntityManagerFactoryBean();
        factory.setDataSource(new DriverManagerDataSource(System.getProperty("schemaCheck.url"), "postgres", "schema-test-only"));
        factory.setPackagesToScan("io.github.huijingmen.softeng789.classroommonitoring");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "validate",
                "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        try { factory.afterPropertiesSet(); }
        finally { factory.destroy(); }
    }
}
