package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.util.Locale;
import java.util.Map;

/**
 * The integration-layer adapter between whatever raw label a lab AI Service sends and this app's
 * canonical incident-type vocabulary. Kept as a single pure function rather than a class
 * hierarchy: when a real AI Service is integrated, only this mapping (and the ingestion
 * endpoint that calls it) needs to change — nothing downstream cares where an event type string
 * came from.
 */
final class EventTypeMapper {
    private static final Map<String, String> KNOWN_ALIASES = Map.ofEntries(
            Map.entry("possible fall", "Fall"),
            Map.entry("fall detected", "Fall"),
            Map.entry("fall", "Fall"),
            Map.entry("student fell", "Fall"),
            Map.entry("lying on floor", "Physical distress"),
            Map.entry("lying on the floor", "Physical distress"),
            Map.entry("possible physical distress", "Physical distress"),
            Map.entry("physical distress", "Physical distress"),
            Map.entry("nosebleed", "Nosebleed"),
            Map.entry("injury", "Injury")
    );

    private EventTypeMapper() {
    }

    /** Never returns blank — an unrecognised label is passed through as-is rather than forced
     *  into "Other", since the raw label is still useful context for the reviewing teacher. */
    static String normalise(String rawEventType) {
        if (rawEventType == null || rawEventType.isBlank()) {
            return "Other";
        }
        String trimmed = rawEventType.trim();
        String alias = KNOWN_ALIASES.get(trimmed.toLowerCase(Locale.ROOT));
        return alias != null ? alias : trimmed;
    }
}
