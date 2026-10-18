package io.github.huijingmen.softeng789.classroommonitoring.client;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class AiServiceRestClientFactoryTest {
    @Test
    void machineCredentialTravelsInHeaderNotTheUrl() {
        var builder = AiServiceRestClientFactory.configure(RestClient.builder(), Duration.ofSeconds(1),
                Duration.ofSeconds(1), "test-only-key");
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("http://ai.test/health")).andExpect(header("X-AI-Adapter-Key", "test-only-key"))
                .andRespond(withSuccess());
        builder.baseUrl("http://ai.test").build().get().uri("/health").retrieve().toBodilessEntity();
        server.verify();
    }
}
