package io.github.huijingmen.softeng789.classroommonitoring.client;

import io.github.huijingmen.softeng789.classroommonitoring.billing.service.PaymentMessageGateway;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Component
@ConditionalOnProperty(name = "ai.payment-message.provider", havingValue = "http")
public class HttpPaymentMessageGateway implements PaymentMessageGateway {
    private static final Logger LOGGER = LoggerFactory.getLogger(HttpPaymentMessageGateway.class);
    private final RestClient restClient;

    public HttpPaymentMessageGateway(
            RestClient.Builder builder,
            @Value("${ai.service.url:http://127.0.0.1:8000}") String serviceUrl,
            @Value("${ai.service.connect-timeout:3s}") Duration connectTimeout,
            @Value("${ai.payment-message.read-timeout:90s}") Duration readTimeout,
            @Value("${ai.service.adapter-key:}") String adapterKey
    ) {
        this.restClient = AiServiceRestClientFactory.configure(builder, connectTimeout, readTimeout, adapterKey)
                .baseUrl(serviceUrl)
                .build();
    }

    @Override
    public GeneratedMessage generate(Request request) {
        try {
            GeneratedMessage response = restClient.post()
                    .uri("/summaries/payment-message")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(GeneratedMessage.class);
            if (response == null || !hasText(response.message()) || !hasText(response.provider())) {
                throw unavailable();
            }
            return response;
        } catch (RestClientException exception) {
            LOGGER.warn("Payment-message AI service is unavailable: {}", exception.getClass().getSimpleName());
            throw unavailable();
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(
                SERVICE_UNAVAILABLE,
                "AI invoice note generation is temporarily unavailable. No draft was saved."
        );
    }
}
