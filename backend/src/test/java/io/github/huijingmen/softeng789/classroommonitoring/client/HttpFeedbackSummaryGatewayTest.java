package io.github.huijingmen.softeng789.classroommonitoring.client;

import io.github.huijingmen.softeng789.classroommonitoring.service.FeedbackSummaryGateway;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class HttpFeedbackSummaryGatewayTest {
    @Test
    void mapsPrivateAiDraftWithoutSendingDirectStudentIdentity() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpFeedbackSummaryGateway gateway = new HttpFeedbackSummaryGateway(builder, "http://ai.test");

        server.expect(requestTo("http://ai.test/summaries/feedback"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.studentName").doesNotExist())
                .andExpect(jsonPath("$.classLabel").value("COMPSCI 335 · 2026"))
                .andExpect(jsonPath("$.feedback[0]").value("Clear contribution in the lab."))
                .andRespond(withSuccess("""
                        {
                          "summary": "The recorded feedback shows steady progress.",
                          "strengths": "Clear contribution in the lab.",
                          "nextSteps": "Continue documenting decisions.",
                          "provider": "QWEN:Qwen/Qwen3-30B-A3B"
                        }
                        """, MediaType.APPLICATION_JSON));

        FeedbackSummaryGateway.GeneratedSummary result = gateway.summarize(
                "Private Student Name",
                "COMPSCI 335 · 2026",
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 9, 30),
                List.of("Clear contribution in the lab."));

        assertThat(result.summary()).isEqualTo("The recorded feedback shows steady progress.");
        assertThat(result.provider()).isEqualTo("QWEN:Qwen/Qwen3-30B-A3B");
        server.verify();
    }

    @Test
    void unavailableAiServiceReturnsSafeRetryableError() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpFeedbackSummaryGateway gateway = new HttpFeedbackSummaryGateway(builder, "http://ai.test");

        server.expect(requestTo("http://ai.test/summaries/feedback"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE)
                        .contentType(MediaType.TEXT_HTML)
                        .body("<h1>internal inference details</h1>"));

        assertThatThrownBy(() -> gateway.summarize(
                "Student",
                "COMPSCI 335",
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 9, 30),
                List.of("Feedback")))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception -> {
                    assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(exception.getReason())
                            .isEqualTo("AI summary generation is temporarily unavailable. No draft was saved.")
                            .doesNotContain("inference details");
                });
        server.verify();
    }
}
