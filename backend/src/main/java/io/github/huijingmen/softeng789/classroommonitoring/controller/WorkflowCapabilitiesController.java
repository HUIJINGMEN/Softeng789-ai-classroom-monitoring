package io.github.huijingmen.softeng789.classroommonitoring.controller;

import io.github.huijingmen.softeng789.classroommonitoring.config.WorkflowCapabilities;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class WorkflowCapabilitiesController {
    private final WorkflowCapabilities capabilities;

    public WorkflowCapabilitiesController(WorkflowCapabilities capabilities) {
        this.capabilities = capabilities;
    }

    @GetMapping("/api/auth/capabilities")
    public WorkflowCapabilities.Availability get() {
        return capabilities.current();
    }
}
