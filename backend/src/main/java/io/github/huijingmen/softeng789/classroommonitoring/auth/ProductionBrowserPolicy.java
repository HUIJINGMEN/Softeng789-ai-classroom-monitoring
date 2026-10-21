package io.github.huijingmen.softeng789.classroommonitoring.auth;

import java.net.URI;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@Profile("production | prod")
public class ProductionBrowserPolicy {
    public ProductionBrowserPolicy(Environment environment) {
        String origin = environment.getProperty("app.public-origin", "");
        URI uri;
        try { uri = URI.create(origin); }
        catch (IllegalArgumentException error) { throw invalidOrigin(); }
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getRawUserInfo() != null
                || !uri.getRawPath().isEmpty() || uri.getRawQuery() != null || uri.getRawFragment() != null
                || uri.getPort() < -1 || uri.getPort() > 65535) throw invalidOrigin();
        if (!origin.equals(environment.getProperty("app.cors.allowed-origins"))) {
            throw new IllegalStateException("Production browser CORS must allow only app.public-origin.");
        }
    }

    private static IllegalStateException invalidOrigin() {
        return new IllegalStateException("Configure PUBLIC_APP_ORIGIN as one HTTPS origin without a path or trailing slash.");
    }
}
