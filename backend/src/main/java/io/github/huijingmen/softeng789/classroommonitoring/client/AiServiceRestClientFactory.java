package io.github.huijingmen.softeng789.classroommonitoring.client;

import java.time.Duration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

final class AiServiceRestClientFactory {
    private AiServiceRestClientFactory() {
    }

    static RestClient.Builder configure(
            RestClient.Builder builder,
            Duration connectTimeout,
            Duration readTimeout
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);
        return builder.requestFactory(requestFactory);
    }
}
