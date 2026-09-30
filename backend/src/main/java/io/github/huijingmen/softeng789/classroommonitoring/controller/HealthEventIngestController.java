package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.HealthAlertResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.IngestHealthEventRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.HealthAlertService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.CREATED;

/**
 * The inbound boundary for the lab AI Service: whenever it detects a possible health/safety event
 * from classroom camera footage, it POSTs here to create a HealthAlert awaiting teacher review.
 * We don't implement or train that detection model — this endpoint just receives its output.
 *
 * Authenticated with a shared secret rather than a user bearer token, since the caller is a
 * server, not a signed-in person. Local tools may call the same authenticated contract to test
 * the pipeline before a real AI Service exists.
 */
@RestController
@RequestMapping("/api/ai/health-events")
public class HealthEventIngestController {
    private final HealthAlertService healthAlertService;

    public HealthEventIngestController(HealthAlertService healthAlertService) {
        this.healthAlertService = healthAlertService;
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public HealthAlertResponse ingest(@Valid @RequestBody IngestHealthEventRequest request) {
        return healthAlertService.ingestAlert(request);
    }
}
