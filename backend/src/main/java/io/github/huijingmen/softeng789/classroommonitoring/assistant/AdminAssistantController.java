package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;

@RestController
@RequestMapping("/api/admin/assistant")
public class AdminAssistantController {
    private final AdminAssistantService assistant;
    public AdminAssistantController(AdminAssistantService assistant) { this.assistant = assistant; }
    @PostMapping("/ask")
    public Answer ask(@Valid @RequestBody Question question,
                      @RequestHeader(value="Authorization", required=false) String authorization) {
        return assistant.ask(question, authorization);
    }
}
