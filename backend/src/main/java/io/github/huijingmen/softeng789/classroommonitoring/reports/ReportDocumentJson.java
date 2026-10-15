package io.github.huijingmen.softeng789.classroommonitoring.reports;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Stored-snapshot serialization only. Scope, authorization and transactions stay in the services. */
final class ReportDocumentJson {
    private ReportDocumentJson() { }

    static <T> T read(ObjectMapper json, String stored, Class<T> type, String errorMessage) {
        try {
            return json.readValue(stored, type);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(errorMessage, exception);
        }
    }

    static String write(ObjectMapper json, Object document, String errorMessage) {
        try {
            return json.writeValueAsString(document);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(errorMessage, exception);
        }
    }
}
