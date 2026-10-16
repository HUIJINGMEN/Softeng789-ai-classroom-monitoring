package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;

/** A supplied student name completes an already scoped read query; no second model call is needed. */
final class AssistantClarificationPlan {
    private AssistantClarificationPlan() { }

    static Plan from(Question question) {
        var scope = question.context();
        if (scope == null || scope.studentId() != null || scope.intent() == Intent.UNSUPPORTED)
            throw new ResponseStatusException(BAD_REQUEST, "Ask a scoped question before choosing a student.");
        if (question.studentSearch().isBlank())
            throw new ResponseStatusException(BAD_REQUEST, "Enter a student name or number.");
        String language = question.message().codePoints().anyMatch(value -> Character.UnicodeScript.of(value) == Character.UnicodeScript.HAN)
                ? "zh" : "en";
        return new Plan(scope.intent(), question.studentSearch().strip(), scope.courseQuery(),
                scope.dateFrom(), scope.dateTo(), false, language, "SOURCE_RECORDS");
    }
}
