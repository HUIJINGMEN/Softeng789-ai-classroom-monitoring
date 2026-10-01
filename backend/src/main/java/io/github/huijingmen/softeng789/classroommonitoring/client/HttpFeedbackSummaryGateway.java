package io.github.huijingmen.softeng789.classroommonitoring.client;

import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFeedbackSummaryRequest;
import io.github.huijingmen.softeng789.classroommonitoring.dto.AiFeedbackSummaryResponse;
import io.github.huijingmen.softeng789.classroommonitoring.service.FeedbackSummaryGateway;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

/** HTTP adapter for privately hosted report-summary inference. */
@Component
@ConditionalOnProperty(name = "ai.feedback-summary.provider", havingValue = "http")
public class HttpFeedbackSummaryGateway implements FeedbackSummaryGateway {
    private static final Logger LOGGER = LoggerFactory.getLogger(HttpFeedbackSummaryGateway.class);
    private static final String UNAVAILABLE_MESSAGE =
            "AI summary generation is temporarily unavailable. No draft was saved.";

    private final RestClient restClient;

    @Autowired
    public HttpFeedbackSummaryGateway(
            RestClient.Builder restClientBuilder,
            @Value("${ai.service.url:http://127.0.0.1:8000}") String aiServiceUrl,
            @Value("${ai.service.connect-timeout:3s}") Duration connectTimeout,
            @Value("${ai.feedback-summary.read-timeout:90s}") Duration readTimeout
    ) {
        this(AiServiceRestClientFactory.configure(restClientBuilder, connectTimeout, readTimeout), aiServiceUrl);
    }

    HttpFeedbackSummaryGateway(RestClient.Builder restClientBuilder, String aiServiceUrl) {
        this.restClient = restClientBuilder.baseUrl(aiServiceUrl).build();
    }

    @Override
    public GeneratedSummary summarize(
            String studentName,
            String classLabel,
            LocalDate dateFrom,
            LocalDate dateTo,
            List<String> feedback
    ) {
        AiFeedbackSummaryRequest request = new AiFeedbackSummaryRequest(
                classLabel, dateFrom, dateTo, List.copyOf(feedback));
        try {
            AiFeedbackSummaryResponse response = restClient.post()
                    .uri("/summaries/feedback")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(AiFeedbackSummaryResponse.class);
            if (!isComplete(response)) {
                LOGGER.warn("Report-summary AI service returned an incomplete response.");
                throw unavailable();
            }
            return new GeneratedSummary(
                    response.summary(), response.strengths(), response.nextSteps(), response.provider());
        } catch (RestClientException ex) {
            LOGGER.warn("Report-summary AI service is unavailable: {}", ex.getClass().getSimpleName());
            throw unavailable();
        }
    }

    private static boolean isComplete(AiFeedbackSummaryResponse response) {
        return response != null
                && hasText(response.summary())
                && hasText(response.strengths())
                && hasText(response.nextSteps())
                && hasText(response.provider());
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(SERVICE_UNAVAILABLE, UNAVAILABLE_MESSAGE);
    }

}
