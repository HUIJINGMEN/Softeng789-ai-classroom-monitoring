package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthAlertResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.IngestHealthEventRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.HealthAlertService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

/**
 * The inbound boundary for the lab AI Service: whenever it detects a possible health/safety event
 * from classroom camera footage, it POSTs here to create a HealthAlert awaiting teacher review.
 * We don't implement or train that detection model — this endpoint just receives its output.
 *
 * Authenticated with a shared secret rather than a user bearer token, since the caller is a
 * server, not a signed-in person. Doubles as the manual/mock trigger for demoing or testing the
 * whole pipeline before a real AI Service exists — curl it with the key below.
 */
@RestController
@RequestMapping("/api/ai/health-events")
public class HealthEventIngestController {
    private final HealthAlertService healthAlertService;
    private final String ingestKey;

    public HealthEventIngestController(
            HealthAlertService healthAlertService,
            @Value("${ai.service.ingest-key:dev-local-key}") String ingestKey
    ) {
        this.healthAlertService = healthAlertService;
        this.ingestKey = ingestKey;
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public HealthAlertResponse ingest(
            @Valid @RequestBody IngestHealthEventRequest request,
            @RequestHeader(value = "X-AI-Service-Key", required = false) String providedKey
    ) {
        if (providedKey == null || !ingestKey.equals(providedKey)) {
            throw new ResponseStatusException(UNAUTHORIZED, "Missing or invalid AI service key.");
        }
        return healthAlertService.ingestAlert(request);
    }
}
