package io.github.huijingmen.softeng789.classroommonitoring.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {
    private final String[] allowedOrigins;

    public CorsConfig(@Value("${app.cors.allowed-origins:"
            + "http://localhost:5173,http://127.0.0.1:5173,"
            + "http://localhost:5174,http://127.0.0.1:5174}") String[] allowedOrigins) {
        this.allowedOrigins = allowedOrigins.clone();
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins(allowedOrigins)
                        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                        .allowedHeaders("*");
            }
        };
    }
}
