package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import io.github.huijingmen.softeng789.classroommonitoring.client.AiServiceRestClientFactory;
import jakarta.validation.Validator;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;

/** No database access here. The model selects a whitelisted query; it never supplies facts or SQL. */
@Component
public class AssistantPlannerGateway {
    private final RestClient client;
    private final Validator validator;
    public AssistantPlannerGateway(RestClient.Builder builder, Validator validator,
            @Value("${ai.service.url:http://127.0.0.1:8000}") String url,
            @Value("${ai.assistant.read-timeout:90s}") Duration timeout) {
        this.client = AiServiceRestClientFactory.configure(builder, Duration.ofSeconds(3), timeout).baseUrl(url).build();
        this.validator = validator;
    }
    public Plan plan(PlannerRequest question) {
        try {
            var result = client.post().uri("/assistant/plan").body(question).retrieve().body(Plan.class);
            if (result == null || !validator.validate(result).isEmpty()) throw unavailable();
            return result;
        } catch (RestClientException exception) {
            throw unavailable();
        }
    }
    private ResponseStatusException unavailable() {
        return new ResponseStatusException(SERVICE_UNAVAILABLE,
                "The assistant is temporarily unavailable. No records were changed. Please retry.");
    }
}
