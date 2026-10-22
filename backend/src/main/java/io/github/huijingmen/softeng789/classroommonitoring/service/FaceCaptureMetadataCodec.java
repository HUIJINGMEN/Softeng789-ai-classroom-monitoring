package io.github.huijingmen.softeng789.classroommonitoring.service;

import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;
import io.github.huijingmen.softeng789.classroommonitoring.dto.FaceEnrollmentCaptureMetadata;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** JSON and pose-name boundary shared by face capture validation and protected-file storage. */
@Component
public class FaceCaptureMetadataCodec {
    private static final TypeReference<List<FaceEnrollmentCaptureMetadata>> CAPTURE_METADATA_LIST =
            new TypeReference<>() {
            };

    private final JsonMapper objectMapper;

    public FaceCaptureMetadataCodec(JsonMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<FaceEnrollmentCaptureMetadata> parseRequired(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture metadata is required.");
        }
        try {
            return objectMapper.readValue(metadataJson, CAPTURE_METADATA_LIST);
        } catch (JacksonException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture metadata could not be read.", ex);
        }
    }

    public byte[] encode(List<FaceEnrollmentCaptureMetadata> metadata) throws IOException {
        try {
            return objectMapper.writeValueAsBytes(metadata);
        } catch (JacksonException ex) {
            throw new IOException("Could not encode enrollment metadata.", ex);
        }
    }

    public List<FaceEnrollmentCaptureMetadata> decode(byte[] metadata) throws IOException {
        try {
            return objectMapper.readValue(metadata, CAPTURE_METADATA_LIST);
        } catch (JacksonException ex) {
            throw new IOException("Could not decode enrollment metadata.", ex);
        }
    }

    public String requireSafePose(String pose) {
        if (pose == null || pose.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture pose is required.");
        }
        String safe = normalisePose(pose);
        if (safe.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Capture pose is invalid.");
        }
        return safe;
    }

    public String safeStoredPose(String pose) {
        if (pose == null || pose.isBlank()) {
            return "unknown";
        }
        String safe = normalisePose(pose);
        return safe.isBlank() ? "unknown" : safe;
    }

    private String normalisePose(String pose) {
        return pose.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "_");
    }
}
