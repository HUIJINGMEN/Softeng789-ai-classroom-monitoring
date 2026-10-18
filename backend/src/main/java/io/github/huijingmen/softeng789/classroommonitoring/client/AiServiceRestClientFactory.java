package io.github.huijingmen.softeng789.classroommonitoring.client;

import java.time.Duration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

public final class AiServiceRestClientFactory {
    private AiServiceRestClientFactory() {
    }

    public static RestClient.Builder configure(
            RestClient.Builder builder,
            Duration connectTimeout,
            Duration readTimeout
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);
        return builder.requestFactory(requestFactory);
    }

    public static RestClient.Builder configure(RestClient.Builder builder, Duration connectTimeout,
            Duration readTimeout, String adapterKey) {
        RestClient.Builder configured = configure(builder, connectTimeout, readTimeout);
        if (adapterKey != null && !adapterKey.isBlank()) configured.defaultHeader("X-AI-Adapter-Key", adapterKey);
        return configured;
    }
}
