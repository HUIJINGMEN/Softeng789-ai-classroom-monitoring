package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

/** Shared machine-to-machine authentication for every inbound laboratory AI event. */
@Component
public class AiServiceAuthenticator {
    private final String ingestKey;

    public AiServiceAuthenticator(@Value("${ai.service.ingest-key:}") String ingestKey) {
        this.ingestKey = ingestKey;
    }

    public void requireValidKey(String providedKey) {
        if (ingestKey.isBlank()) {
            throw new ResponseStatusException(
                    SERVICE_UNAVAILABLE,
                    "AI event ingestion is disabled until AI_INGEST_KEY is configured."
            );
        }
        if (providedKey == null || !secureEquals(ingestKey, providedKey)) {
            throw new ResponseStatusException(UNAUTHORIZED, "Missing or invalid AI service key.");
        }
    }

    private static boolean secureEquals(String expected, String actual) {
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8)
        );
    }
}
