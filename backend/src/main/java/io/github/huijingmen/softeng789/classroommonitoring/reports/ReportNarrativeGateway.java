package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.client.AiServiceRestClientFactory;
import io.github.huijingmen.softeng789.classroommonitoring.service.FeedbackSummaryGateway;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

@Component
public class ReportNarrativeGateway {
    private final RestClient client;
    private final String provider;
    private final FeedbackSummaryGateway legacy;
    public ReportNarrativeGateway(RestClient.Builder builder, FeedbackSummaryGateway legacy,
            @Value("${ai.service.url:http://127.0.0.1:8000}") String url,
            @Value("${ai.feedback-summary.provider:demo}") String provider,
            @Value("${ai.feedback-summary.read-timeout:90s}") Duration timeout,
            @Value("${ai.service.adapter-key:}") String adapterKey) {
        this.client = AiServiceRestClientFactory.configure(builder, Duration.ofSeconds(3), timeout, adapterKey).baseUrl(url).build();
        this.provider = provider;
        this.legacy = legacy;
    }
    public Generation generate(Document document, Section section) {
        return generate(document.dateFrom(), document.dateTo(), section, "STUDENT");
    }
    public Generation generateClass(ClassReportModels.Document document, Section section) {
        return generate(document.dateFrom(), document.dateTo(), section, "CLASS");
    }
    public Generation generateOverall(OverallReportModels.Document document, Section section) {
        return generate(document.dateFrom(), document.dateTo(), section, document.audience() == OverallReportModels.Audience.PARTNER
                ? "PARTNER" : "INTERNAL");
    }
    private Generation generate(java.time.LocalDate from, java.time.LocalDate to, Section section, String audience) {
        if (section.evidence().size() > 100 || section.evidence().stream().anyMatch(fact -> fact.length() > 4000)
                || section.evidence().stream().mapToInt(String::length).sum() > 48000) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "This section has too much source text for one AI draft. Narrow the dates or courses, or write and save the summary manually. No text was changed.");
        }
        if (!"http".equals(provider)) {
            if (section.topic() != Topic.LEARNING) return new Generation(
                    "Demo mode: no AI narrative was generated. Review the source records and write this section before approval.",
                    "Not applicable.", "Not applicable.", "DEMO");
            if (!"STUDENT".equals(audience)) return new Generation("Demo mode: write a summary from the source records before approval.",
                    "Not applicable.", "Not applicable.", "DEMO");
            var result = legacy.summarize("", section.title(), from, to, section.evidence());
            return new Generation(result.summary(), result.strengths(), result.nextSteps(), result.provider());
        }
        try {
            var result = client.post().uri("/summaries/feedback")
                    .body(new AiRequest(section.title(), from, to, section.evidence(), section.topic().name(), audience))
                    .retrieve().body(Generation.class);
            if (result == null || result.summary() == null || result.summary().isBlank()
                    || result.provider() == null || result.provider().isBlank()
                    || (section.topic() == Topic.LEARNING && (result.strengths() == null || result.strengths().isBlank()
                        || result.nextSteps() == null || result.nextSteps().isBlank()))) throw unavailable();
            return result;
        } catch (RestClientException exception) { throw unavailable(); }
    }
    private ResponseStatusException unavailable() {
        return new ResponseStatusException(SERVICE_UNAVAILABLE,
                "AI generation is unavailable. Your saved text is unchanged. Check the AI service and retry this section.");
    }
}
