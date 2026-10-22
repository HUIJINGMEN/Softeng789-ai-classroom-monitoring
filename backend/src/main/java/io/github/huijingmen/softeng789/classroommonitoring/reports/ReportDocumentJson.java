package io.github.huijingmen.softeng789.classroommonitoring.reports;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/** Stored-snapshot serialization only. Scope, authorization and transactions stay in the services. */
final class ReportDocumentJson {
    private ReportDocumentJson() { }

    static <T> T read(JsonMapper json, String stored, Class<T> type, String errorMessage) {
        try {
            return json.readValue(stored, type);
        } catch (JacksonException exception) {
            throw new IllegalStateException(errorMessage, exception);
        }
    }

    static String write(JsonMapper json, Object document, String errorMessage) {
        try {
            return json.writeValueAsString(document);
        } catch (JacksonException exception) {
            throw new IllegalStateException(errorMessage, exception);
        }
    }
}
