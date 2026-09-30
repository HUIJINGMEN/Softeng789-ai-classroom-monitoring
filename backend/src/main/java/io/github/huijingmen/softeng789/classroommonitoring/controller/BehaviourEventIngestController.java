package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.dto.BehaviourEventResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.IngestBehaviourEventRequest;
import io.github.huijingmen.softeng789.classroommonitoring.service.BehaviourEventService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.CREATED;

/** Machine-to-machine boundary for candidate classroom observations from the laboratory service. */
@RestController
@RequestMapping("/api/ai/behaviour-events")
public class BehaviourEventIngestController {
    private final BehaviourEventService behaviourEventService;

    public BehaviourEventIngestController(BehaviourEventService behaviourEventService) {
        this.behaviourEventService = behaviourEventService;
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public BehaviourEventResponse ingest(@Valid @RequestBody IngestBehaviourEventRequest request) {
        return behaviourEventService.ingestEvent(request);
    }
}
