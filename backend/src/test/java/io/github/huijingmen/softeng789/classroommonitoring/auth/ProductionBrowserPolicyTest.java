package io.github.huijingmen.softeng789.classroommonitoring.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionBrowserPolicyTest {
    @Test void productionRequiresOneExplicitHttpsOriginAndNoCrossOriginBrowserCredentials() {
        for (String value : new String[]{"", "http://school.test", "https://school.test/", "https://school.test/api",
                "https://name:password@school.test", "https://school.test?query", "https://school.test#fragment"}) {
            var environment = new MockEnvironment().withProperty("app.public-origin", value)
                    .withProperty("app.cors.allowed-origins", value);
            assertThatThrownBy(() -> new ProductionBrowserPolicy(environment)).isInstanceOf(IllegalStateException.class);
        }
        var environment = new MockEnvironment().withProperty("app.public-origin", "https://school.test")
                .withProperty("app.cors.allowed-origins", "https://school.test");
        assertThatCode(() -> new ProductionBrowserPolicy(environment)).doesNotThrowAnyException();
        environment.setProperty("app.cors.allowed-origins", "*");
        assertThatThrownBy(() -> new ProductionBrowserPolicy(environment)).isInstanceOf(IllegalStateException.class);
    }
}
