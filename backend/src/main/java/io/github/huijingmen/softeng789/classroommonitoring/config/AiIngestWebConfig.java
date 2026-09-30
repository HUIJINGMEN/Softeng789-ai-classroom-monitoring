package io.github.huijingmen.softeng789.classroommonitoring.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Keeps the authentication boundary for current and future AI ingestion routes in one place. */
@Configuration
public class AiIngestWebConfig implements WebMvcConfigurer {
    private final AiIngestAuthenticationInterceptor authenticationInterceptor;

    public AiIngestWebConfig(AiIngestAuthenticationInterceptor authenticationInterceptor) {
        this.authenticationInterceptor = authenticationInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authenticationInterceptor)
                .addPathPatterns("/api/ai/**");
    }
}
